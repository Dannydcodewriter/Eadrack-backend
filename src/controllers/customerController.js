const prisma = require("../config/database");
const { logActivity } = require("../utils/helpers");

// Get all customers
exports.getAllCustomers = async (req, res) => {
	try {
		const { search } = req.query;

		let where = {};

		// Search filter
		if (search) {
			where.OR = [
				{ name: { contains: search, mode: "insensitive" } },
				{ email: { contains: search, mode: "insensitive" } },
				{ phone: { contains: search } },
			];
		}

		const customers = await prisma.customer.findMany({
			where,
			include: {
				createdBy: {
					select: { fullName: true },
				},
				_count: {
					select: { sales: true },
				},
			},
			orderBy: { createdAt: "desc" },
		});

		// Total spent / items for every customer in ONE grouped query
		// (previously one query per customer, which was slow and could
		// exhaust the database connection pool).
		const totals = await prisma.sale.groupBy({
			by: ["customerId"],
			where: { customerId: { in: customers.map((c) => c.id) } },
			_sum: { totalPrice: true, quantity: true },
		});
		const totalsByCustomer = new Map(totals.map((t) => [t.customerId, t._sum]));

		const customersWithAnalytics = customers.map((customer) => {
			const sum = totalsByCustomer.get(customer.id);
			return {
				...customer,
				totalPurchases: customer._count.sales,
				totalSpent: sum?.totalPrice ?? 0,
				totalItems: sum?.quantity ?? 0,
			};
		});

		res.json({ customers: customersWithAnalytics });
	} catch (error) {
		console.error("Get customers error:", error);
		res.status(500).json({ error: "Failed to get customers" });
	}
};

// Get single customer with analytics
exports.getCustomer = async (req, res) => {
	try {
		const { id } = req.params;

		const customer = await prisma.customer.findUnique({
			where: { id },
			include: {
				createdBy: {
					select: { fullName: true, email: true },
				},
				sales: {
					include: {
						product: true,
						staff: {
							select: { fullName: true },
						},
					},
					orderBy: { saleDate: "desc" },
				},
			},
		});

		if (!customer) {
			return res.status(404).json({ error: "Customer not found" });
		}

		// Calculate analytics
		const totalSpent = customer.sales.reduce(
			(sum, sale) => sum + sale.totalPrice,
			0
		);
		const totalItems = customer.sales.reduce(
			(sum, sale) => sum + sale.quantity,
			0
		);
		const lastPurchase =
			customer.sales.length > 0 ? customer.sales[0].saleDate : null;

		// Products purchased
		const productsPurchased = {};
		customer.sales.forEach((sale) => {
			if (!productsPurchased[sale.productId]) {
				productsPurchased[sale.productId] = {
					product: sale.product,
					quantity: 0,
					total: 0,
				};
			}
			productsPurchased[sale.productId].quantity += sale.quantity;
			productsPurchased[sale.productId].total += sale.totalPrice;
		});

		const analytics = {
			totalPurchases: customer.sales.length,
			totalSpent,
			totalItems,
			lastPurchase,
			productsPurchased: Object.values(productsPurchased),
			salesHistory: customer.sales,
		};

		res.json({
			customer: {
				...customer,
				analytics,
			},
		});
	} catch (error) {
		console.error("Get customer error:", error);
		res.status(500).json({ error: "Failed to get customer" });
	}
};

// Create customer
exports.createCustomer = async (req, res) => {
	try {
		const { name, phone, email, businessName, address, customerType } =
			req.body;

		// Validate input
		if (!name || !phone) {
			return res.status(400).json({ error: "Name and phone are required" });
		}

		const customer = await prisma.customer.create({
			data: {
				name,
				phone,
				email,
				businessName,
				address,
				customerType: customerType || "INDIVIDUAL",
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
			"customer_created",
			"customer",
			customer.id,
			{ name, phone }
		);

		res.status(201).json({
			message: "Customer created successfully",
			customer,
		});
	} catch (error) {
		console.error("Create customer error:", error);
		res.status(500).json({ error: "Failed to create customer" });
	}
};

// Update customer
exports.updateCustomer = async (req, res) => {
	try {
		const { id } = req.params;
		const { name, phone, email, businessName, address, customerType } =
			req.body;

		const customer = await prisma.customer.update({
			where: { id },
			data: {
				...(name && { name }),
				...(phone && { phone }),
				...(email !== undefined && { email }),
				...(businessName !== undefined && { businessName }),
				...(address !== undefined && { address }),
				...(customerType && { customerType }),
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
			"customer_updated",
			"customer",
			id,
			{
				name,
				phone,
			}
		);

		res.json({
			message: "Customer updated successfully",
			customer,
		});
	} catch (error) {
		console.error("Update customer error:", error);
		res.status(500).json({ error: "Failed to update customer" });
	}
};

// Delete customer (Admin only)
exports.deleteCustomer = async (req, res) => {
	try {
		const { id } = req.params;

		await prisma.customer.delete({
			where: { id },
		});

		// Log activity
		await logActivity(
			prisma,
			req.user.userId,
			"customer_deleted",
			"customer",
			id,
			{}
		);

		res.json({ message: "Customer deleted successfully" });
	} catch (error) {
		console.error("Delete customer error:", error);
		res.status(500).json({ error: "Failed to delete customer" });
	}
};
