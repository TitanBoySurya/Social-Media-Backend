const express = require("express");
const router = express.Router();

const followController = require("../controllers/followController");
const verifyToken = require("../middleware/authMiddleware");

router.post("/toggle/:userId", verifyToken, followController.toggleFollow);
router.get("/user/:userId", verifyToken, followController.getUserProfile);

module.exports = router;