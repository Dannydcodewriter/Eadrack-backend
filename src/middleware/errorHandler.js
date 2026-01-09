const errorHandler = (err, req, res, next) => {
	console.error("Error:", err);

	// Prisma errors
	if (err.code === "P2002") {
		return res.status(400).json({
			error: "Duplicate entry",
			message: `${err.meta.target} already exists`,
		});
	}

	if (err.code === "P2025") {
		return res.status(404).json({
			error: "Not found",
			message: "Record not found",
		});
	}

	// JWT errors
	if (err.name === "JsonWebTokenError") {
		return res.status(401).json({
			error: "Invalid token",
			message: "Please login again",
		});
	}

	// Validation errors
	if (err.name === "ValidationError") {
		return res.status(400).json({
			error: "Validation error",
			message: err.message,
		});
	}

	// Default error
	res.status(err.status || 500).json({
		error: err.message || "Internal server error",
		...(process.env.NODE_ENV === "development" && { stack: err.stack }),
	});
};

module.exports = errorHandler;
