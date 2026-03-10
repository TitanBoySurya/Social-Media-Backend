const express = require("express");
const router = express.Router();

// ✅ Sahi path aur naam (Aapke project structure ke hisaab se)
const verifyToken = require("../middleware/authMiddleware"); 
const userController = require("../controllers/userController");

// =========================
// PROTECTED PROFILE ROUTE
// =========================
// Ise userController ke getProfile function se connect karein
router.get("/profile", verifyToken, userController.getProfile);

module.exports = router;