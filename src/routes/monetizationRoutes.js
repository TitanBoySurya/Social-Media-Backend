const express = require('express');
const router = express.Router();
const monetizationController = require('../controllers/monetizationController');
const verifyToken = require('../middleware/authMiddleware');

router.get('/wallet', verifyToken, monetizationController.getWalletDetails);
router.get('/history', verifyToken, monetizationController.getTransactions);
router.post('/view/:postId', verifyToken, monetizationController.trackPostView);
router.post('/withdraw', verifyToken, monetizationController.requestWithdrawal);

module.exports = router;