const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const { authenticateToken, isAdmin } = require("../middleware/auth");

// All routes require authentication
router.use(authenticateToken);

// Get routes (All authenticated users)
router.get("/", customerController.getAllCustomers);
router.get("/:id", customerController.getCustomer);

// Create/Update routes (All authenticated users)
router.post("/", customerController.createCustomer);
router.put("/:id", customerController.updateCustomer);

// Admin only routes
router.delete("/:id", isAdmin, customerController.deleteCustomer);

module.exports = router;
