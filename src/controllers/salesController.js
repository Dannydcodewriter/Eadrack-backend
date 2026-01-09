const prisma = require("../config/database");
const { logActivity } = require("../utils/helpers");

// Get all sales
exports.getAllSales = async (req, res) => {
	try {
		const { month, startDate, endDate, productId, customerId, staffId } =
			req.query;

		let where = {};

		// Filter by month
		if (month) {
			where.month = month;
		}

		// Filter by date range
		if (startDate && endDate) {
			where.saleDate = {
				gte: new Date(startDate),
				lte: new Date(endDate),
			};
		}

		// Filter by product
		if (productId) {
			where.productId = productId;
		}

		// Filter by customer
		if (customerId) {
			where.customerId = customerId;
		}

		// Filter by staff (Admin only)
		if (staffId && req.user.role === "ADMIN") {
			where.staffId = staffId;
		}

		// If staff, only show their sales
		if (req.user.role === "STAFF") {
			where.staffId = req.user.userId; // FIXED
		}

		const sales = await prisma.sale.findMany({
			where,
			include: {
				product: true,
				customer: true,
				staff: {
					select: { fullName: true, email: true },
				},
			},
			orderBy: { saleDate: "desc" },
		});

		res.json({ sales });
	} catch (error) {
		console.error("Get sales error:", error);
		res.status(500).json({ error: "Failed to get sales" });
	}
};

// Get single sale
exports.getSale = async (req, res) => {
	try {
		const { id } = req.params;

		const sale = await prisma.sale.findUnique({
			where: { id },
			include: {
				product: true,
				customer: true,
				staff: {
					select: { fullName: true, email: true },
				},
			},
		});

		if (!sale) {
			return res.status(404).json({ error: "Sale not found" });
		}

		// If staff, only allow viewing their own sales
		if (req.user.role === "STAFF" && sale.staffId !== req.user.userId) {
			// FIXED
			return res.status(403).json({ error: "Access denied" });
		}

		res.json({ sale });
	} catch (error) {
		console.error("Get sale error:", error);
		res.status(500).json({ error: "Failed to get sale" });
	}
};

// Create sale
exports.createSale = async (req, res) => {
	try {
		const { productId, customerId, quantity, month } = req.body;

		console.log("📝 Creating sale:", {
			productId,
			customerId,
			quantity,
			month,
			userId: req.user.userId,
		});

		// Validate input
		if (!productId || !customerId || !quantity || !month) {
			return res.status(400).json({ error: "All fields are required" });
		}

		// Check product availability
		const product = await prisma.product.findUnique({
			where: { id: productId },
		});

		if (!product) {
			return res.status(404).json({ error: "Product not found" });
		}

		if (product.currentStock < parseInt(quantity)) {
			return res.status(400).json({
				error: "Insufficient stock",
				available: product.currentStock,
			});
		}

		// Check if customer exists
		const customer = await prisma.customer.findUnique({
			where: { id: customerId },
		});

		if (!customer) {
			return res.status(404).json({ error: "Customer not found" });
		}

		// Calculate total price
		const unitPrice = product.price;
		const totalPrice = unitPrice * parseInt(quantity);

		// Create sale and update stock in a transaction
		const result = await prisma.$transaction(async (tx) => {
			// Create sale
			const sale = await tx.sale.create({
				data: {
					productId,
					customerId,
					staffId: req.user.userId, // FIXED
					quantity: parseInt(quantity),
					unitPrice,
					totalPrice,
					month,
				},
				include: {
					product: true,
					customer: true,
					staff: {
						select: { fullName: true },
					},
				},
			});

			// Update product stock
			await tx.product.update({
				where: { id: productId },
				data: { currentStock: { decrement: parseInt(quantity) } },
			});

			// Create stock adjustment record
			await tx.stockAdjustment.create({
				data: {
					productId,
					adjustmentType: "SALE",
					quantityChange: -parseInt(quantity),
					previousStock: product.currentStock,
					newStock: product.currentStock - parseInt(quantity),
					reason: `Sale to ${customer.name}`,
					adjustedById: req.user.userId, // FIXED
				},
			});

			return sale;
		});

		// Log activity
		await logActivity(
			prisma,
			req.user.userId,
			"sale_created",
			"sale",
			result.id,
			{
				// FIXED
				productName: product.name,
				quantity,
				totalPrice,
			}
		);

		console.log("✅ Sale created successfully:", result.id);

		res.status(201).json({
			message: "Sale recorded successfully",
			sale: result,
		});
	} catch (error) {
		console.error("❌ Create sale error:", error);
		res.status(500).json({ error: "Failed to create sale" });
	}
};

// Update sale (Admin only, within 24 hours)
exports.updateSale = async (req, res) => {
	try {
		const { id } = req.params;
		const { quantity } = req.body;

		const sale = await prisma.sale.findUnique({
			where: { id },
			include: { product: true },
		});

		if (!sale) {
			return res.status(404).json({ error: "Sale not found" });
		}

		// Check if sale is within 24 hours
		const saleAge = Date.now() - new Date(sale.saleDate).getTime();
		const twentyFourHours = 24 * 60 * 60 * 1000;

		if (saleAge > twentyFourHours) {
			return res
				.status(400)
				.json({ error: "Can only edit sales within 24 hours" });
		}

		if (!quantity) {
			return res.status(400).json({ error: "Quantity is required" });
		}

		const quantityDiff = parseInt(quantity) - sale.quantity;
		const product = sale.product;

		// Check if we have enough stock for increase
		if (quantityDiff > 0 && product.currentStock < quantityDiff) {
			return res.status(400).json({
				error: "Insufficient stock for update",
				available: product.currentStock,
			});
		}

		// Update sale and adjust stock in transaction
		const result = await prisma.$transaction(async (tx) => {
			const newTotalPrice = product.price * parseInt(quantity);

			// Update sale
			const updatedSale = await tx.sale.update({
				where: { id },
				data: {
					quantity: parseInt(quantity),
					totalPrice: newTotalPrice,
				},
				include: {
					product: true,
					customer: true,
					staff: {
						select: { fullName: true },
					},
				},
			});

			// Adjust product stock
			await tx.product.update({
				where: { id: sale.productId },
				data: { currentStock: { increment: -quantityDiff } },
			});

			// Create stock adjustment record
			if (quantityDiff !== 0) {
				await tx.stockAdjustment.create({
					data: {
						productId: sale.productId,
						adjustmentType: "CORRECTION",
						quantityChange: -quantityDiff,
						previousStock: product.currentStock,
						newStock: product.currentStock - quantityDiff,
						reason: `Sale update - adjusted by ${quantityDiff}`,
						adjustedById: req.user.userId, // FIXED
					},
				});
			}

			return updatedSale;
		});

		// Log activity
		await logActivity(prisma, req.user.userId, "sale_updated", "sale", id, {
			// FIXED
			oldQuantity: sale.quantity,
			newQuantity: quantity,
		});

		res.json({
			message: "Sale updated successfully",
			sale: result,
		});
	} catch (error) {
		console.error("Update sale error:", error);
		res.status(500).json({ error: "Failed to update sale" });
	}
};

// Delete sale (Admin only)
exports.deleteSale = async (req, res) => {
	try {
		const { id } = req.params;

		const sale = await prisma.sale.findUnique({
			where: { id },
			include: { product: true },
		});

		if (!sale) {
			return res.status(404).json({ error: "Sale not found" });
		}

		// Delete sale and restore stock in transaction
		await prisma.$transaction(async (tx) => {
			// Delete sale
			await tx.sale.delete({
				where: { id },
			});

			// Restore product stock
			await tx.product.update({
				where: { id: sale.productId },
				data: { currentStock: { increment: sale.quantity } },
			});

			// Create stock adjustment record
			await tx.stockAdjustment.create({
				data: {
					productId: sale.productId,
					adjustmentType: "CORRECTION",
					quantityChange: sale.quantity,
					previousStock: sale.product.currentStock,
					newStock: sale.product.currentStock + sale.quantity,
					reason: "Sale deleted - stock restored",
					adjustedById: req.user.userId, // FIXED
				},
			});
		});

		// Log activity
		await logActivity(prisma, req.user.userId, "sale_deleted", "sale", id, {
			// FIXED
			quantity: sale.quantity,
			totalPrice: sale.totalPrice,
		});

		res.json({ message: "Sale deleted successfully" });
	} catch (error) {
		console.error("Delete sale error:", error);
		res.status(500).json({ error: "Failed to delete sale" });
	}
};

// Get monthly sales summary
exports.getMonthlySummary = async (req, res) => {
	try {
		const { year } = req.query;
		const currentYear = year || new Date().getFullYear();

		const months = [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December",
		];

		const monthlySummary = await Promise.all(
			months.map(async (month) => {
				const sales = await prisma.sale.findMany({
					where: {
						month,
						saleDate: {
							gte: new Date(`${currentYear}-01-01`),
							lte: new Date(`${currentYear}-12-31`),
						},
					},
				});

				const totalRevenue = sales.reduce(
					(sum, sale) => sum + sale.totalPrice,
					0
				);
				const totalQuantity = sales.reduce(
					(sum, sale) => sum + sale.quantity,
					0
				);

				return {
					month,
					totalRevenue,
					totalQuantity,
					salesCount: sales.length,
				};
			})
		);

		res.json({ monthlySummary });
	} catch (error) {
		console.error("Get monthly summary error:", error);
		res.status(500).json({ error: "Failed to get monthly summary" });
	}
};
