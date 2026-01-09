const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function createAdmin() {
	try {
		console.log("🔍 Checking for existing admin...");

		const existing = await prisma.user.findUnique({
			where: { email: "admin@eadrack.com" },
		});

		if (existing) {
			console.log("✅ Admin already exists!");
			console.log("📧 Email: admin@eadrack.com");
			console.log("🔑 Password: admin123");
			return;
		}

		console.log("🔐 Creating admin user...");

		const hashedPassword = await bcrypt.hash("admin123", 10);

		const admin = await prisma.user.create({
			data: {
				email: "admin@eadrack.com",
				password: hashedPassword,
				fullName: "Admin User",
				role: "ADMIN",
				isActive: true,
			},
		});

		console.log("\n✅ Admin created successfully!");
		console.log("📧 Email:", admin.email);
		console.log("🔑 Password: admin123");
		console.log("👤 Name:", admin.fullName);
		console.log("🎭 Role:", admin.role);
	} catch (error) {
		console.error("❌ Error:", error.message);
	} finally {
		await prisma.$disconnect();
	}
}

createAdmin();
