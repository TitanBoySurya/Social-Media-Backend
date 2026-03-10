const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware"); // Apne middleware ka sahi naam check karein
const commentController = require("../controllers/commentController");

// Add comment (Protected)
router.post("/:id", verifyToken, commentController.addComment);

// Get comments (Public or Protected - usually public for social media)
router.get("/:id", commentController.getCommentsByPost);

module.exports = router;