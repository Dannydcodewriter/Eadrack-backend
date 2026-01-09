const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { authenticateToken, isAdmin } = require("../middleware/auth");

// All routes require authentication
router.use(authenticateToken);

// Get routes (All authenticated users)
router.get("/", productController.getAllProducts);
router.get("/low-stock", productController.getLowStockProducts);
router.get("/:id", productController.getProduct);

// Admin only routes
router.post("/", isAdmin, productController.createProduct);
router.put("/:id", isAdmin, productController.updateProduct);
router.delete("/:id", isAdmin, productController.deleteProduct);
router.post("/:id/adjust-stock", isAdmin, productController.adjustStock);

module.exports = router;
