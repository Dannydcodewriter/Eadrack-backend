const prisma = require("../config/database");

// Get dashboard stats
exports.getDashboardStats = async (req, res) => {
	try {
		// Total revenue
		const allSales = await prisma.sale.findMany();
		const totalRevenue = allSales.reduce(
			(sum, sale) => sum + sale.totalPrice,
			0
		);
		const totalUnitsSold = allSales.reduce(
			(sum, sale) => sum + sale.quantity,
			0
		);

		// Total customers
		const totalCustomers = await prisma.customer.count();

		// Total products
		const totalProducts = await prisma.product.count();

		// Low stock products
		const products = await prisma.product.findMany();
		const lowStockCount = products.filter(
			(p) => p.currentStock <= p.reorderLevel && p.currentStock > 0
		).length;

		// Today's sales
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const todaySales = await prisma.sale.findMany({
			where: {
				saleDate: {
					gte: today,
				},
			},
		});
		const todayRevenue = todaySales.reduce(
			(sum, sale) => sum + sale.totalPrice,
			0
		);

		// Current month sales
		const currentMonth = new Date().toLocaleString("default", {
			month: "long",
		});
		const monthSales = await prisma.sale.findMany({
			where: { month: currentMonth },
		});
		const monthRevenue = monthSales.reduce(
			(sum, sale) => sum + sale.totalPrice,
			0
		);

		res.json({
			totalRevenue,
			totalUnitsSold,
			totalCustomers,
			totalProducts,
			lowStockCount,
			todayRevenue,
			todayUnits: todaySales.reduce((sum, sale) => sum + sale.quantity, 0),
			monthRevenue,
			monthUnits: monthSales.reduce((sum, sale) => sum + sale.quantity, 0),
		});
	} catch (error) {
		console.error("Get dashboard stats error:", error);
		res.status(500).json({ error: "Failed to get dashboard stats" });
	}
};

// Get top products
exports.getTopProducts = async (req, res) => {
	try {
		const { limit = 5 } = req.query;

		const sales = await prisma.sale.findMany({
			include: {
				product: true,
			},
		});

		// Group by product and calculate totals
		const productStats = {};
		sales.forEach((sale) => {
			if (!productStats[sale.productId]) {
				productStats[sale.productId] = {
					product: sale.product,
					totalSold: 0,
					totalRevenue: 0,
				};
			}
			productStats[sale.productId].totalSold += sale.quantity;
			productStats[sale.productId].totalRevenue += sale.totalPrice;
		});

		// Sort by revenue and get top products
		const topProducts = Object.values(productStats)
			.sort((a, b) => b.totalRevenue - a.totalRevenue)
			.slice(0, parseInt(limit));

		res.json({ topProducts });
	} catch (error) {
		console.error("Get top products error:", error);
		res.status(500).json({ error: "Failed to get top products" });
	}
};

// Get top customers
exports.getTopCustomers = async (req, res) => {
	try {
		const { limit = 5 } = req.query;

		const customers = await prisma.customer.findMany({
			include: {
				sales: true,
			},
		});

		// Calculate total spent for each customer
		const customerStats = customers.map((customer) => {
			const totalSpent = customer.sales.reduce(
				(sum, sale) => sum + sale.totalPrice,
				0
			);
			const totalPurchases = customer.sales.length;
			const totalItems = customer.sales.reduce(
				(sum, sale) => sum + sale.quantity,
				0
			);

			return {
				customer: {
					id: customer.id,
					name: customer.name,
					phone: customer.phone,
					email: customer.email,
				},
				totalSpent,
				totalPurchases,
				totalItems,
			};
		});

		// Sort by total spent and get top customers
		const topCustomers = customerStats
			.sort((a, b) => b.totalSpent - a.totalSpent)
			.slice(0, parseInt(limit));

		res.json({ topCustomers });
	} catch (error) {
		console.error("Get top customers error:", error);
		res.status(500).json({ error: "Failed to get top customers" });
	}
};

// Get revenue trends
exports.getRevenueTrends = async (req, res) => {
	try {
		const { period = "monthly" } = req.query;

		if (period === "monthly") {
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

			const trends = await Promise.all(
				months.map(async (month) => {
					const sales = await prisma.sale.findMany({
						where: { month },
					});

					return {
						month,
						revenue: sales.reduce((sum, sale) => sum + sale.totalPrice, 0),
						quantity: sales.reduce((sum, sale) => sum + sale.quantity, 0),
						salesCount: sales.length,
					};
				})
			);

			return res.json({ trends });
		}

		res.json({ trends: [] });
	} catch (error) {
		console.error("Get revenue trends error:", error);
		res.status(500).json({ error: "Failed to get revenue trends" });
	}
};
