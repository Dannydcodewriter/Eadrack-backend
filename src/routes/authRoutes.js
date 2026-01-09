// // verify-admin.js - Fixed for prisma.config.ts
// const { PrismaClient } = require("@prisma/client");
// const bcrypt = require("bcryptjs");

// // Initialize without config to use default settings
// const prisma = new PrismaClient();

// async function verifyAdmin() {
// 	try {
// 		console.log("🔍 Looking for admin user...\n");

// 		const admin = await prisma.user.findUnique({
// 			where: { email: "admin@eadrack.com" },
// 		});

// 		if (!admin) {
// 			console.log("❌ Admin user NOT found in database!");
// 			console.log("Run: node create-admin.js to create it");
// 			return;
// 		}

// 		console.log("✅ Admin user found!");
// 		console.log("📧 Email:", admin.email);
// 		console.log("👤 Name:", admin.fullName);
// 		console.log("🔑 Role:", admin.role);
// 		console.log("✓ Active:", admin.isActive);
// 		console.log("\n🔐 Testing password hash...");

// 		// Test if password matches
// 		const passwordMatch = await bcrypt.compare("admin123", admin.password);

// 		if (passwordMatch) {
// 			console.log("✅ Password hash is CORRECT!");
// 			console.log("\nThe user exists and password should work.");
// 			console.log("Check your backend login route for issues.");
// 		} else {
// 			console.log("❌ Password hash is INCORRECT!");
// 			console.log("\nUpdating password...");

// 			const newHash = await bcrypt.hash("admin123", 10);
// 			await prisma.user.update({
// 				where: { email: "admin@eadrack.com" },
// 				data: { password: newHash },
// 			});

// 			console.log("✅ Password updated! Try logging in again.");
// 		}
// 	} catch (error) {
// 		console.error("❌ Error:", error.message);
// 		console.log("\nFull error:", error);
// 	} finally {
// 		await prisma.$disconnect();
// 	}
// }

// verifyAdmin();


const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateToken, isAdmin } = require("../middleware/auth");

// Public routes
router.post("/login", authController.login);

// Protected routes
router.get("/me", authenticateToken, authController.getMe);

// Admin only routes
router.post("/register", authenticateToken, isAdmin, authController.register);
router.get("/users", authenticateToken, isAdmin, authController.getAllUsers);
router.patch(
	"/users/:id/deactivate",
	authenticateToken,
	isAdmin,
	authController.deactivateUser
);

module.exports = router;