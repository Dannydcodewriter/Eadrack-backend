const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Hash password
const hashPassword = async (password) => {
	const salt = await bcrypt.genSalt(10);
	return await bcrypt.hash(password, salt);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
	return await bcrypt.compare(password, hashedPassword);
};

// Generate JWT token
const generateToken = (userId, role) => {
	return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
		expiresIn: "7d",
	});
};

// Generate SKU
const generateSKU = (productName) => {
	const prefix = productName.substring(0, 3).toUpperCase();
	const random = Math.random().toString(36).substring(2, 8).toUpperCase();
	const timestamp = Date.now().toString().slice(-4);
	return `${prefix}-${random}-${timestamp}`;
};

// Log activity
const logActivity = async (
	prisma,
	userId,
	actionType,
	entityType,
	entityId,
	details
) => {
	try {
		await prisma.activityLog.create({
			data: {
				userId,
				actionType,
				entityType,
				entityId,
				details: JSON.stringify(details),
			},
		});
	} catch (error) {
		console.error("Activity log error:", error);
	}
};

module.exports = {
	hashPassword,
	comparePassword,
	generateToken,
	generateSKU,
	logActivity,
};
