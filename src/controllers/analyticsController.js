const prisma = require("../config/database");

// All analytics are computed by the database (aggregate / groupBy) instead of
// loading every sale into memory. Response shapes are unchanged.

const MONTHS = [
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

// Get dashboard stats
exports.getDashboardStats = async (req, res) => {
	try {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const currentMonth = new Date().toLocaleString("default", {
			month: "long",
		});
		const sums = { _sum: { totalPrice: true, quantity: true } };

		const [allSales, totalCustomers, products, todaySales, monthSales] =
			await Promise.all([
				prisma.sale.aggregate(sums),
				prisma.customer.count(),
				prisma.product.findMany({
					select: { currentStock: true, reorderLevel: true },
				}),
				prisma.sale.aggregate({ ...sums, where: { saleDate: { gte: today } } }),
				prisma.sale.aggregate({ ...sums, where: { month: currentMonth } }),
			]);

		const lowStockCount = products.filter(
			(p) => p.currentStock <= p.reorderLevel && p.currentStock > 0
		).length;

		res.json({
			totalRevenue: allSales._sum.totalPrice ?? 0,
			totalUnitsSold: allSales._sum.quantity ?? 0,
			totalCustomers,
			totalProducts: products.length,
			lowStockCount,
			todayRevenue: todaySales._sum.totalPrice ?? 0,
			todayUnits: todaySales._sum.quantity ?? 0,
			monthRevenue: monthSales._sum.totalPrice ?? 0,
			monthUnits: monthSales._sum.quantity ?? 0,
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

		const totals = await prisma.sale.groupBy({
			by: ["productId"],
			_sum: { quantity: true, totalPrice: true },
		});

		const top = totals
			.map((t) => ({
				productId: t.productId,
				totalSold: t._sum.quantity ?? 0,
				totalRevenue: t._sum.totalPrice ?? 0,
			}))
			.sort((a, b) => b.totalRevenue - a.totalRevenue)
			.slice(0, parseInt(limit));

		const products = await prisma.product.findMany({
			where: { id: { in: top.map((t) => t.productId) } },
		});
		const productsById = new Map(products.map((p) => [p.id, p]));

		const topProducts = top.map((t) => ({
			product: productsById.get(t.productId),
			totalSold: t.totalSold,
			totalRevenue: t.totalRevenue,
		}));

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

		const [customers, totals] = await Promise.all([
			prisma.customer.findMany({
				select: { id: true, name: true, phone: true, email: true },
			}),
			prisma.sale.groupBy({
				by: ["customerId"],
				_sum: { totalPrice: true, quantity: true },
				_count: { _all: true },
			}),
		]);
		const totalsByCustomer = new Map(totals.map((t) => [t.customerId, t]));

		// Every customer is ranked (including those with no sales yet).
		const topCustomers = customers
			.map((customer) => {
				const t = totalsByCustomer.get(customer.id);
				return {
					customer,
					totalSpent: t?._sum.totalPrice ?? 0,
					totalPurchases: t?._count._all ?? 0,
					totalItems: t?._sum.quantity ?? 0,
				};
			})
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
			const totals = await prisma.sale.groupBy({
				by: ["month"],
				where: { month: { in: MONTHS } },
				_sum: { totalPrice: true, quantity: true },
				_count: { _all: true },
			});
			const totalsByMonth = new Map(totals.map((t) => [t.month, t]));

			const trends = MONTHS.map((month) => {
				const t = totalsByMonth.get(month);
				return {
					month,
					revenue: t?._sum.totalPrice ?? 0,
					quantity: t?._sum.quantity ?? 0,
					salesCount: t?._count._all ?? 0,
				};
			});

			return res.json({ trends });
		}

		res.json({ trends: [] });
	} catch (error) {
		console.error("Get revenue trends error:", error);
		res.status(500).json({ error: "Failed to get revenue trends" });
	}
};
