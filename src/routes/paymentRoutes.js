const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const verifyToken = require("../middleware/authMiddleware");

router.get("/wallet-balance", verifyToken, paymentController.getWalletBalance);
router.post("/send-coins", verifyToken, paymentController.sendCoins);
router.post("/withdraw", verifyToken, paymentController.withdraw);

module.exports = router;