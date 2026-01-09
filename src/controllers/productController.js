const prisma = require("../config/database");
const { generateSKU, logActivity } = require("../utils/helpers");

// Get all products
exports.getAllProducts = async (req, res) => {
	try {
		const { search, category, status } = req.query;

		let where = {};

		// Search filter
		if (search) {
			where.OR = [
				{ name: { contains: search, mode: "insensitive" } },
				{ sku: { contains: search, mode: "insensitive" } },
				{ category: { contains: search, mode: "insensitive" } },
			];
		}

		// Category filter
		if (category) {
			where.category = category;
		}

		// Status filter (in stock, low stock, out of stock)
		if (status === "low") {
			// Products where currentStock <= reorderLevel
			const products = await prisma.product.findMany({
				where,
				include: {
					createdBy: {
						select: { fullName: true },
					},
				},
				orderBy: { createdAt: "desc" },
			});

			const lowStockProducts = products.filter(
				(p) => p.currentStock <= p.reorderLevel && p.currentStock > 0
			);
			return res.json({ products: lowStockProducts });
		}

		if (status === "out") {
			where.currentStock = 0;
		}

		if (status === "in") {
			where.currentStock = { gt: 0 };
		}

		const products = await prisma.product.findMany({
			where,
			include: {
				createdBy: {
					select: { fullName: true },
				},
			},
			orderBy: { createdAt: "desc" },
		});

		res.json({ products });
	} catch (error) {
		console.error("Get products error:", error);
		res.status(500).json({ error: "Failed to get products" });
	}
};

// Get single product
exports.getProduct = async (req, res) => {
	try {
		const { id } = req.params;

		const product = await prisma.product.findUnique({
			where: { id },
			include: {
				createdBy: {
					select: { fullName: true, email: true },
				},
				sales: {
					include: {
						customer: true,
						staff: {
							select: { fullName: true },
						},
					},
					orderBy: { saleDate: "desc" },
					take: 10,
				},
			},
		});

		if (!product) {
			return res.status(404).json({ error: "Product not found" });
		}

		res.json({ product });
	} catch (error) {
		console.error("Get product error:", error);
		res.status(500).json({ error: "Failed to get product" });
	}
};

// Create product (Admin only)
exports.createProduct = async (req, res) => {
	try {
		const {
			name,
			category,
			initialStock,
			price,
			reorderLevel,
			supplier,
			description,
		} = req.body;

		// Validate input
		if (!name || !category || !initialStock || !price) {
			return res
				.status(400)
				.json({
					error: "Name, category, initial stock, and price are required",
				});
		}

		// Generate SKU if not provided
		const sku = req.body.sku || generateSKU(name);

		const product = await prisma.product.create({
			data: {
				name,
				sku,
				category,
				initialStock: parseInt(initialStock),
				currentStock: parseInt(initialStock),
				price: parseFloat(price),
				reorderLevel: reorderLevel ? parseInt(reorderLevel) : 10,
				supplier,
				description,
				createdById: req.user.userId,
			},
			include: {
				createdBy: {
					select: { fullName: true },
				},
			},
		});

		// Log activity
		await logActivity(
			prisma,
			req.user.userId,
			"product_created",
			"product",
			product.id,
			{ name, sku, initialStock }
		);

		res.status(201).json({
			message: "Product created successfully",
			product,
		});
	} catch (error) {
		console.error("Create product error:", error);
		if (error.code === "P2002") {
			return res.status(400).json({ error: "Product SKU already exists" });
		}
		res.status(500).json({ error: "Failed to create product" });
	}
};

// Update product (Admin only)
exports.updateProduct = async (req, res) => {
	try {
		const { id } = req.params;
		const { name, category, price, reorderLevel, supplier, description } =
			req.body;

		const product = await prisma.product.update({
			where: { id },
			data: {
				...(name && { name }),
				...(category && { category }),
				...(price && { price: parseFloat(price) }),
				...(reorderLevel && { reorderLevel: parseInt(reorderLevel) }),
				...(supplier !== undefined && { supplier }),
				...(description !== undefined && { description }),
			},
			include: {
				createdBy: {
					select: { fullName: true },
				},
			},
		});

		// Log activity
		await logActivity(prisma, req.user.userId, "product_updated", "product", id, {
			name,
			price,
		});

		res.json({
			message: "Product updated successfully",
			product,
		});
	} catch (error) {
		console.error("Update product error:", error);
		res.status(500).json({ error: "Failed to update product" });
	}
};

// Delete product (Admin only)
exports.deleteProduct = async (req, res) => {
	try {
		const { id } = req.params;

		await prisma.product.delete({
			where: { id },
		});

		// Log activity
		await logActivity(
			prisma,
			req.user.userId,
			"product_deleted",
			"product",
			id,
			{}
		);

		res.json({ message: "Product deleted successfully" });
	} catch (error) {
		console.error("Delete product error:", error);
		res.status(500).json({ error: "Failed to delete product" });
	}
};

// Adjust stock (Admin only)
exports.adjustStock = async (req, res) => {
	try {
		const { id } = req.params;
		const { quantityChange, reason } = req.body;

		const product = await prisma.product.findUnique({
			where: { id },
		});

		if (!product) {
			return res.status(404).json({ error: "Product not found" });
		}

		const newStock = product.currentStock + parseInt(quantityChange);

		if (newStock < 0) {
			return res.status(400).json({ error: "Stock cannot be negative" });
		}

		// Update product stock
		const updatedProduct = await prisma.product.update({
			where: { id },
			data: { currentStock: newStock },
		});

		// Create stock adjustment record
		await prisma.stockAdjustment.create({
			data: {
				productId: id,
				adjustmentType: quantityChange > 0 ? "ADDITION" : "CORRECTION",
				quantityChange: parseInt(quantityChange),
				previousStock: product.currentStock,
				newStock,
				reason,
				adjustedById: req.user.userId,
			},
		});

		// Log activity
		await logActivity(prisma, req.user.userId, "stock_adjusted", "product", id, {
			quantityChange,
			previousStock: product.currentStock,
			newStock,
		});

		res.json({
			message: "Stock adjusted successfully",
			product: updatedProduct,
		});
	} catch (error) {
		console.error("Adjust stock error:", error);
		res.status(500).json({ error: "Failed to adjust stock" });
	}
};

// Get low stock products
exports.getLowStockProducts = async (req, res) => {
	try {
		const products = await prisma.product.findMany({
			include: {
				createdBy: {
					select: { fullName: true },
				},
			},
		});

		// Filter products where currentStock <= reorderLevel and currentStock > 0
		const lowStockProducts = products.filter(
			(p) => p.currentStock <= p.reorderLevel && p.currentStock > 0
		);

		res.json({ products: lowStockProducts });
	} catch (error) {
		console.error("Get low stock error:", error);
		res.status(500).json({ error: "Failed to get low stock products" });
	}
};
