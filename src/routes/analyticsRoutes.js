const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const { authenticateToken } = require("../middleware/auth");

// All routes require authentication
router.use(authenticateToken);

router.get("/dashboard", analyticsController.getDashboardStats);
router.get("/top-products", analyticsController.getTopProducts);
router.get("/top-customers", analyticsController.getTopCustomers);
router.get("/revenue-trends", analyticsController.getRevenueTrends);

module.exports = router;
