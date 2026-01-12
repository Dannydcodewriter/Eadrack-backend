const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const customerRoutes = require("./routes/customerRoutes");
const salesRoutes = require("./routes/salesRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

// Import middleware
const errorHandler = require("./middleware/errorHandler");

// Initialize express app
const app = express();

// Middleware
app.use(
	cors({
		origin: true, // Allow all origins for now
		credentials: true,
	})
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://eadrack-frontend-gt8h.vercel.app',  // ✅ Add your Vercel URL
    'https://*.vercel.app'  // ✅ Allow all Vercel preview deployments
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Add this AFTER your middleware section and BEFORE the routes
app.get("/", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Eadrack Backend API is running"
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/analytics", analyticsRoutes);

// Health check route
app.get("/api/health", (req, res) => {
	res.json({ status: "OK", message: "Eadrack Backend is running" });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`🚀 Eadrack Backend running on port ${PORT}`);
	console.log(`📍 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
