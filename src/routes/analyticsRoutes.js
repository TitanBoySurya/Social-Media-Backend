const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const verifyToken = require("../middleware/authMiddleware");

// Route: POST /api/analytics/track-view/:postId
router.post("/track-view/:postId", verifyToken, analyticsController.trackView);

module.exports = router;