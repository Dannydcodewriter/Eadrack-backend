// const prisma = require("../config/database");
// const {
// 	hashPassword,
// 	comparePassword,
// 	generateToken,
// 	logActivity,
// } = require("../utils/helpers");

// // Register new user (Admin only)
// exports.register = async (req, res) => {
// 	try {
// 		const { email, password, fullName, role } = req.body;

// 		// Validate input
// 		if (!email || !password || !fullName) {
// 			return res.status(400).json({ error: "All fields are required" });
// 		}

// 		// Check if user exists
// 		const existingUser = await prisma.user.findUnique({
// 			where: { email },
// 		});

// 		if (existingUser) {
// 			return res.status(400).json({ error: "User already exists" });
// 		}

// 		// Hash password
// 		const hashedPassword = await hashPassword(password);

// 		// Create user
// 		const user = await prisma.user.create({
// 			data: {
// 				email,
// 				password: hashedPassword,
// 				fullName,
// 				role: role || "STAFF",
// 			},
// 			select: {
// 				id: true,
// 				email: true,
// 				fullName: true,
// 				role: true,
// 				createdAt: true,
// 			},
// 		});

// 		// Log activity
// 		await logActivity(prisma, req.user.id, "user_created", "user", user.id, {
// 			email,
// 			role: user.role,
// 		});

// 		res.status(201).json({
// 			message: "User created successfully",
// 			user,
// 		});
// 	} catch (error) {
// 		console.error("Register error:", error);
// 		res.status(500).json({ error: "Failed to create user" });
// 	}
// };

// // Login
// exports.login = async (req, res) => {
// 	try {
// 		const { email, password } = req.body;

// 		// Validate input
// 		if (!email || !password) {
// 			return res.status(400).json({ error: "Email and password required" });
// 		}

// 		// Find user
// 		const user = await prisma.user.findUnique({
// 			where: { email },
// 		});

// 		if (!user) {
// 			return res.status(401).json({ error: "Invalid credentials" });
// 		}

// 		// Check if user is active
// 		if (!user.isActive) {
// 			return res.status(403).json({ error: "Account is deactivated" });
// 		}

// 		// Compare password
// 		const isValidPassword = await comparePassword(password, user.password);

// 		if (!isValidPassword) {
// 			return res.status(401).json({ error: "Invalid credentials" });
// 		}

// 		// Update last login
// 		await prisma.user.update({
// 			where: { id: user.id },
// 			data: { lastLogin: new Date() },
// 		});

// 		// Generate token
// 		const token = generateToken(user.id, user.role);

// 		// Log activity
// 		await logActivity(prisma, user.id, "user_login", "user", user.id, {
// 			email,
// 		});

// 		res.json({
// 			message: "Login successful",
// 			token,
// 			user: {
// 				id: user.id,
// 				email: user.email,
// 				fullName: user.fullName,
// 				role: user.role,
// 			},
// 		});
// 	} catch (error) {
// 		console.error("Login error:", error);
// 		res.status(500).json({ error: "Login failed" });
// 	}
// };

// // Get current user
// exports.getMe = async (req, res) => {
// 	try {
// 		const user = await prisma.user.findUnique({
// 			where: { id: req.user.id },
// 			select: {
// 				id: true,
// 				email: true,
// 				fullName: true,
// 				role: true,
// 				isActive: true,
// 				createdAt: true,
// 				lastLogin: true,
// 			},
// 		});

// 		res.json({ user });
// 	} catch (error) {
// 		console.error("Get me error:", error);
// 		res.status(500).json({ error: "Failed to get user" });
// 	}
// };

// // Get all users (Admin only)
// exports.getAllUsers = async (req, res) => {
// 	try {
// 		const users = await prisma.user.findMany({
// 			select: {
// 				id: true,
// 				email: true,
// 				fullName: true,
// 				role: true,
// 				isActive: true,
// 				createdAt: true,
// 				lastLogin: true,
// 			},
// 			orderBy: { createdAt: "desc" },
// 		});

// 		res.json({ users });
// 	} catch (error) {
// 		console.error("Get users error:", error);
// 		res.status(500).json({ error: "Failed to get users" });
// 	}
// };

// // Deactivate user (Admin only)
// exports.deactivateUser = async (req, res) => {
// 	try {
// 		const { id } = req.params;

// 		const user = await prisma.user.update({
// 			where: { id },
// 			data: { isActive: false },
// 			select: {
// 				id: true,
// 				email: true,
// 				fullName: true,
// 				isActive: true,
// 			},
// 		});

// 		// Log activity
// 		await logActivity(prisma, req.user.id, "user_deactivated", "user", id, {
// 			email: user.email,
// 		});

// 		res.json({
// 			message: "User deactivated successfully",
// 			user,
// 		});
// 	} catch (error) {
// 		console.error("Deactivate user error:", error);
// 		res.status(500).json({ error: "Failed to deactivate user" });
// 	}
// };


const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/database");

// Login
exports.login = async (req, res) => {
	try {
		const { email, password } = req.body;

		console.log("🔍 Login attempt:", email);

		// Validate input
		if (!email || !password) {
			return res.status(400).json({
				message: "Email and password are required",
			});
		}

		// Find user
		const user = await prisma.user.findUnique({
			where: { email: email.toLowerCase().trim() },
		});

		if (!user) {
			console.log("❌ User not found:", email);
			return res.status(401).json({
				message: "Invalid credentials",
			});
		}

		console.log("✅ User found:", user.email);

		// Check if user is active
		if (!user.isActive) {
			console.log("❌ User is deactivated:", email);
			return res.status(403).json({
				message: "Account is deactivated",
			});
		}

		// Verify password
		const isValidPassword = await bcrypt.compare(password, user.password);

		if (!isValidPassword) {
			console.log("❌ Invalid password for:", email);
			return res.status(401).json({
				message: "Invalid credentials",
			});
		}

		console.log("✅ Password verified for:", email);

		// Update last login
		await prisma.user.update({
			where: { id: user.id },
			data: { lastLogin: new Date() },
		});

		// Generate JWT token
		const token = jwt.sign(
			{
				userId: user.id,
				email: user.email,
				role: user.role,
			},
			process.env.JWT_SECRET,
			{ expiresIn: "24h" }
		);

		console.log("✅ Login successful for:", email);

		// Return user data (without password)
		res.json({
			token,
			user: {
				id: user.id,
				email: user.email,
				fullName: user.fullName,
				role: user.role,
				isActive: user.isActive,
			},
		});
	} catch (error) {
		console.error("❌ Login error:", error);
		res.status(500).json({
			message: "Server error during login",
			error: error.message,
		});
	}
};

// Get current user
exports.getMe = async (req, res) => {
	try {
		const user = await prisma.user.findUnique({
			where: { id: req.user.userId },
			select: {
				id: true,
				email: true,
				fullName: true,
				role: true,
				isActive: true,
				createdAt: true,
				lastLogin: true,
			},
		});

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		res.json(user);
	} catch (error) {
		console.error("Get user error:", error);
		res.status(500).json({ message: "Server error" });
	}
};

// Register new user (Admin only)
exports.register = async (req, res) => {
	try {
		const { email, password, fullName, role } = req.body;

		// Validate input
		if (!email || !password || !fullName) {
			return res.status(400).json({
				message: "Email, password, and full name are required",
			});
		}

		// Check if user already exists
		const existingUser = await prisma.user.findUnique({
			where: { email: email.toLowerCase().trim() },
		});

		if (existingUser) {
			return res.status(400).json({
				message: "User with this email already exists",
			});
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create user
		const user = await prisma.user.create({
			data: {
				email: email.toLowerCase().trim(),
				password: hashedPassword,
				fullName,
				role: role || "STAFF",
				isActive: true,
			},
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId: req.user.userId,
				actionType: "USER_CREATED",
				entityType: "USER",
				entityId: user.id,
				details: `Created user: ${user.email}`,
			},
		});

		res.status(201).json({
			message: "User created successfully",
			user: {
				id: user.id,
				email: user.email,
				fullName: user.fullName,
				role: user.role,
			},
		});
	} catch (error) {
		console.error("Register error:", error);
		res.status(500).json({ message: "Server error" });
	}
};

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
	try {
		const users = await prisma.user.findMany({
			select: {
				id: true,
				email: true,
				fullName: true,
				role: true,
				isActive: true,
				createdAt: true,
				lastLogin: true,
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		res.json(users);
	} catch (error) {
		console.error("Get users error:", error);
		res.status(500).json({ message: "Server error" });
	}
};

// Deactivate user (Admin only)
exports.deactivateUser = async (req, res) => {
	try {
		const { id } = req.params;

		// Prevent deactivating yourself
		if (id === req.user.userId) {
			return res.status(400).json({
				message: "You cannot deactivate your own account",
			});
		}

		const user = await prisma.user.update({
			where: { id },
			data: { isActive: false },
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId: req.user.userId,
				actionType: "USER_DEACTIVATED",
				entityType: "USER",
				entityId: user.id,
				details: `Deactivated user: ${user.email}`,
			},
		});

		res.json({
			message: "User deactivated successfully",
			user: {
				id: user.id,
				email: user.email,
				isActive: user.isActive,
			},
		});
	} catch (error) {
		console.error("Deactivate user error:", error);
		res.status(500).json({ message: "Server error" });
	}
};