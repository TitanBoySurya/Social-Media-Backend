const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
// Yeh line missing thi (Import karna zaroori hai):
const followController = require("../controllers/followController");

/*
================================
FOLLOW / UNFOLLOW (TOGGLE)
POST /api/follow/toggle/:id
================================
*/
router.post("/toggle/:id", auth, followController.toggleFollow);

module.exports = router;