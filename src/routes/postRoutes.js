const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const verifyToken = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// CREATE: POST /api/posts/create
router.post('/create', verifyToken, upload.single('image'), postController.createPost);

// GET ALL: GET /api/posts/all
router.get('/all', postController.getAllPosts); // 👈 Yahan 'getAllPosts' check karein

// FOLLOWING: GET /api/posts/following
router.get('/following', verifyToken, postController.getFollowingPosts);

// DELETE: DELETE /api/posts/:id
router.delete('/:id', verifyToken, postController.deletePost);

module.exports = router;