const express = require("express");
const router = express.Router();

const postController = require("../controllers/postController");
const followController = require("../controllers/followController");
const auth = require("../middleware/authMiddleware");

const upload = require("../middleware/multer");

// ================= POSTS =================
router.post("/posts", auth, upload.single("video"), postController.createPost);
router.get("/posts/feed", auth, postController.getFeed);
router.post("/posts/:postId/like", auth, postController.toggleLike);
router.post("/posts/:postId/view", auth, postController.addView);
router.post("/posts/:postId/comment", auth, postController.addComment);

// ================= USERS =================
router.post("/users/:userId/follow", auth, followController.toggleFollow);
router.get("/users/:userId", auth, followController.getUserProfile);

module.exports = router;