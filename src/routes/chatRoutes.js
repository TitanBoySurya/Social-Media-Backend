const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const chatController = require("../controllers/chatController");

// Message bhejne ke liye
router.post("/send", auth, chatController.sendMessage);

// Chat history dekhne ke liye
router.get("/history/:userId", auth, chatController.getMessages);

module.exports = router;