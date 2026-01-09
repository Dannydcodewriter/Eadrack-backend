const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function resetAdminPassword() {
	try {
		console.log("🔐 Resetting admin password...");

		// Hash the password with bcrypt
		const hashedPassword = await bcrypt.hash("admin123", 10);

		console.log("Generated hash:", hashedPassword);

		// Update the admin user
		const admin = await prisma.user.update({
			where: { email: "admin@eadrack.com" },
			data: {
				password: hashedPassword,
				isActive: true,
			},
		});

		console.log("\n✅ Admin password reset successfully!");
		console.log("📧 Email: admin@eadrack.com");
		console.log("🔑 Password: admin123");
		console.log("👤 Name:", admin.fullName);
		console.log("🎭 Role:", admin.role);
		console.log("🟢 Active:", admin.isActive);

		// Test the password immediately
		console.log("\n🧪 Testing password...");
		const testMatch = await bcrypt.compare("admin123", hashedPassword);
		console.log("Password test:", testMatch ? "✅ PASS" : "❌ FAIL");
	} catch (error) {
		console.error("❌ Error:", error.message);
	} finally {
		await prisma.$disconnect();
	}
}

resetAdminPassword();
