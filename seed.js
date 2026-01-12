const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

// Define all users
const users = [
	{
		email: "admin@eadrack.com",
		password: "admin123",
		fullName: "Admin User",
		role: "ADMIN",
	},
	{
		email: "nwakozochukwuka@gmail.com",
		password: "Daniel123",
		fullName: "Daniel Nwakozo Chukwuka",
		role: "ADMIN",
	},
	{
		email: "c.mgbeobuna@eadracktrading.com",
		password: "Chioma2026",
		fullName: "Chioma Mgbeobuna",
		role: "ADMIN",
	},
	{
		email: "maria@eadracktrading.com",
		password: "Maria2026",
		fullName: "Maria",
		role: "ADMIN",
	},
	{
		email: "hassan@eadracktrading.com",
		password: "Hassan2026",
		fullName: "Mr Hassan",
		role: "ADMIN",
	},
	{
		email: "osawe@eadracktrading.com",
		password: "Osawe2026",
		fullName: "Mr Osawe",
		role: "ADMIN",
	},
	{
		email: "amadin@eadracktrading.com",
		password: "Amadin2026",
		fullName: "Mrs Amadin",
		role: "ADMIN",
	},
];

async function main() {
	console.log("🌱 Starting database seed...\n");

	try {
		for (const userData of users) {
			// Hash password
			const hashedPassword = await bcrypt.hash(userData.password, 10);

			// Create or update user
			const user = await prisma.user.upsert({
				where: { email: userData.email },
				update: {
					password: hashedPassword,
					fullName: userData.fullName,
					role: userData.role,
				},
				create: {
					email: userData.email,
					password: hashedPassword,
					fullName: userData.fullName,
					role: userData.role,
				},
			});

			console.log(`✅ ${user.role}: ${user.fullName} (${user.email})`);
		}

		console.log("\n📋 Login Credentials Summary:");
		console.log("═══════════════════════════════════════════════════════");
		users.forEach((user) => {
			console.log(`\n👤 ${user.fullName}`);
			console.log(`   Email: ${user.email}`);
			console.log(`   Password: ${user.password}`);
			console.log(`   Role: ${user.role}`);
		});
		console.log("\n═══════════════════════════════════════════════════════");
		console.log("✅ All users created successfully!");
	} catch (error) {
		console.error("❌ Error seeding database:", error);
		throw error;
	}
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
