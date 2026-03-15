const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const commentController = require("../controllers/commentController");


// ===============================
// ADD COMMENT (Protected Route)
// POST /api/comments/:postId
// ===============================
router.post("/:postId", verifyToken, commentController.addComment);


// ===============================
// GET COMMENTS BY POST
// GET /api/comments/:postId
// ===============================
router.get("/:postId", commentController.getCommentsByPost);


module.exports = router;