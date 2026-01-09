const express = require("express");
const router = express.Router();
const salesController = require("../controllers/salesController");
const { authenticateToken, isAdmin } = require("../middleware/auth");

// All routes require authentication
router.use(authenticateToken);

// Get routes (All authenticated users)
router.get("/", salesController.getAllSales);
router.get("/monthly-summary", salesController.getMonthlySummary);
router.get("/:id", salesController.getSale);

// Create routes (All authenticated users)
router.post("/", salesController.createSale);

// Admin only routes
router.put("/:id", isAdmin, salesController.updateSale);
router.delete("/:id", isAdmin, salesController.deleteSale);

module.exports = router;
