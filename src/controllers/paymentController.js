const supabase = require("../config/supabaseClient");

// 💰 Wallet ka balance check karna
exports.getWalletBalance = async (req, res) => {
  try {
    const { data } = await supabase
      .from("wallets")
      .select("coins")
      .eq("user_id", req.user.id)
      .maybeSingle();

    res.json({ success: true, coins: data?.coins || 0 });
  } catch (err) {
    res.status(500).json({ success: false });
  }
}

// 💸 Coins transfer karna (Gifting)
exports.sendCoins = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, amount } = req.body;

    if (amount <= 0) return res.status(400).json({ message: "Invalid amount" });

    // Atomic transaction using RPC
    const { error } = await supabase.rpc("transfer_coins", {
      sender: senderId,
      receiver: receiverId,
      amount: parseInt(amount)
    });

    if (error) throw error;

    res.json({ success: true, message: "Coins gifted successfully! 🎁" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// 🏧 Withdrawal Request
exports.withdraw = async (req, res) => {
  try {
    const { amount, upi_id } = req.body;

    if (amount < 500) return res.status(400).json({ message: "Minimum 500 coins required" });

    const { error } = await supabase.from("withdrawals").insert([{
      user_id: req.user.id,
      amount,
      upi_id,
      status: "pending"
    }]);

    if (error) throw error;
    res.json({ success: true, message: "Withdrawal request submitted! 🏦" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};