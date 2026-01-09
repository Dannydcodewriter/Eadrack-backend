const jwt = require("jsonwebtoken");
const prisma = require("../config/database");

// Verify JWT token
const authenticateToken = async (req, res, next) => {
	try {
		const authHeader = req.headers["authorization"];
		const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

		if (!token) {
			return res.status(401).json({ error: "Access token required" });
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);

		// Get user from database
		const user = await prisma.user.findUnique({
			where: { id: decoded.userId },
			select: {
				id: true,
				email: true,
				fullName: true,
				role: true,
				isActive: true,
			},
		});

		if (!user || !user.isActive) {
			return res.status(403).json({ error: "User not found or inactive" });
		}

			req.user = {
				...user,
				userId: user.id, // ✅ Add this line
			};
		next();
	} catch (error) {
		return res.status(403).json({ error: "Invalid or expired token" });
	}
};

// Check if user is admin
const isAdmin = (req, res, next) => {
	if (req.user.role !== "ADMIN") {
		return res.status(403).json({ error: "Admin access required" });
	}
	next();
};

// Check if user is staff or admin
const isStaffOrAdmin = (req, res, next) => {
	if (req.user.role !== "ADMIN" && req.user.role !== "STAFF") {
		return res.status(403).json({ error: "Staff or Admin access required" });
	}
	next();
};

module.exports = {
	authenticateToken,
	isAdmin,
	isStaffOrAdmin,
};
