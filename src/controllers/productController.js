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

// ---------------------------------------------------------------------------
// Restocking (refilling existing products with newly received goods)
//
// A restock increases BOTH currentStock and initialStock. initialStock is
// therefore "total units ever received", which keeps every
// `sold = initialStock - currentStock` calculation in the app correct.
// Each restock is recorded as an ADDITION in stock_adjustments.
// ---------------------------------------------------------------------------

const MAX_SHIPMENT_ITEMS = 200;

class RestockError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

const cleanText = (value, maxLength = 200) =>
	typeof value === "string" && value.trim()
		? value.trim().slice(0, maxLength)
		: undefined;

const parseQuantity = (value) => {
	const quantity = Number(value);
	return Number.isInteger(quantity) && quantity > 0 && quantity <= 1000000
		? quantity
		: null;
};

// Returns undefined when no price was sent, null when the price is invalid.
const parsePrice = (value) => {
	if (value === undefined || value === null || value === "") return undefined;
	const price = Number(value);
	return Number.isFinite(price) && price >= 0 ? price : null;
};

const buildReason = ({ reference, supplier, note }) =>
	[
		"Restock",
		reference && `Ref: ${reference}`,
		supplier && `Supplier: ${supplier}`,
		note,
	]
		.filter(Boolean)
		.join(" · ");

// Applies one restock line inside a transaction.
const applyRestock = async (tx, { productId, quantity, price, supplier, reason, userId }) => {
	const existing = await tx.product.findUnique({ where: { id: productId } });
	if (!existing) {
		throw new RestockError(404, "Product not found");
	}

	const product = await tx.product.update({
		where: { id: productId },
		data: {
			currentStock: { increment: quantity },
			initialStock: { increment: quantity },
			...(price !== undefined && { price }),
			...(supplier && { supplier }),
		},
	});

	await tx.stockAdjustment.create({
		data: {
			productId,
			adjustmentType: "ADDITION",
			quantityChange: quantity,
			previousStock: product.currentStock - quantity,
			newStock: product.currentStock,
			reason,
			adjustedById: userId,
		},
	});

	return { product, previousPrice: existing.price };
};

// Restock a single product (Admin only)
// POST /api/products/:id/restock
// body: { quantity, price?, supplier?, reference?, note? }
exports.restockProduct = async (req, res) => {
	try {
		const { id } = req.params;
		const quantity = parseQuantity(req.body.quantity);
		const price = parsePrice(req.body.price);
		const supplier = cleanText(req.body.supplier);
		const reference = cleanText(req.body.reference, 100);
		const note = cleanText(req.body.note, 300);

		if (!quantity) {
			return res
				.status(400)
				.json({ error: "Quantity must be a whole number greater than 0" });
		}
		if (price === null) {
			return res.status(400).json({ error: "Price must be a number of 0 or more" });
		}

		const { product, previousPrice } = await prisma.$transaction((tx) =>
			applyRestock(tx, {
				productId: id,
				quantity,
				price,
				supplier,
				reason: buildReason({ reference, supplier, note }),
				userId: req.user.userId,
			})
		);

		await logActivity(prisma, req.user.userId, "product_restocked", "product", id, {
			quantity,
			newStock: product.currentStock,
			reference,
			supplier,
			...(price !== undefined && price !== previousPrice && { previousPrice, price }),
		});

		res.json({
			message: `Added ${quantity} unit(s) to ${product.name}`,
			product,
		});
	} catch (error) {
		if (error instanceof RestockError) {
			return res.status(error.status).json({ error: error.message });
		}
		console.error("Restock product error:", error);
		res.status(500).json({ error: "Failed to restock product" });
	}
};

// Receive a shipment: restock many products at once, all-or-nothing (Admin only)
// POST /api/products/restock
// body: { items: [{ productId, quantity, price? }], supplier?, reference?, note? }
exports.receiveShipment = async (req, res) => {
	try {
		const { items } = req.body;
		const supplier = cleanText(req.body.supplier);
		const reference = cleanText(req.body.reference, 100);
		const note = cleanText(req.body.note, 300);

		if (!Array.isArray(items) || items.length === 0) {
			return res.status(400).json({ error: "Add at least one product to the shipment" });
		}
		if (items.length > MAX_SHIPMENT_ITEMS) {
			return res
				.status(400)
				.json({ error: `A shipment can have at most ${MAX_SHIPMENT_ITEMS} products` });
		}

		const seen = new Set();
		const lines = [];
		for (const [index, item] of items.entries()) {
			const productId = typeof item?.productId === "string" ? item.productId : "";
			const quantity = parseQuantity(item?.quantity);
			const price = parsePrice(item?.price);
			if (!productId) {
				return res.status(400).json({ error: `Line ${index + 1}: choose a product` });
			}
			if (seen.has(productId)) {
				return res
					.status(400)
					.json({ error: `Line ${index + 1}: this product is already in the shipment` });
			}
			if (!quantity) {
				return res.status(400).json({
					error: `Line ${index + 1}: quantity must be a whole number greater than 0`,
				});
			}
			if (price === null) {
				return res
					.status(400)
					.json({ error: `Line ${index + 1}: price must be a number of 0 or more` });
			}
			seen.add(productId);
			lines.push({ productId, quantity, price });
		}

		const reason = buildReason({ reference, supplier, note });

		const products = await prisma.$transaction(
			async (tx) => {
				const updated = [];
				for (const line of lines) {
					const { product } = await applyRestock(tx, {
						...line,
						supplier,
						reason,
						userId: req.user.userId,
					});
					updated.push(product);
				}
				return updated;
			},
			{ timeout: 30000 }
		);

		const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);

		await logActivity(prisma, req.user.userId, "shipment_received", "product", null, {
			reference,
			supplier,
			productCount: lines.length,
			totalUnits,
		});

		res.json({
			message: `Received ${totalUnits} unit(s) across ${lines.length} product(s)`,
			products,
		});
	} catch (error) {
		if (error instanceof RestockError) {
			return res.status(error.status).json({ error: error.message });
		}
		console.error("Receive shipment error:", error);
		res.status(500).json({ error: "Failed to receive shipment" });
	}
};

// Stock history for one product
// GET /api/products/:id/stock-history?type=ADDITION&limit=50
exports.getStockHistory = async (req, res) => {
	try {
		const { id } = req.params;
		const type = ["ADDITION", "SALE", "CORRECTION"].includes(req.query.type)
			? req.query.type
			: undefined;
		const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

		const history = await prisma.stockAdjustment.findMany({
			where: { productId: id, ...(type && { adjustmentType: type }) },
			orderBy: { createdAt: "desc" },
			take: limit,
			include: { adjustedBy: { select: { fullName: true } } },
		});

		res.json({ history });
	} catch (error) {
		console.error("Get stock history error:", error);
		res.status(500).json({ error: "Failed to get stock history" });
	}
};
