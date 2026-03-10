const supabase = require('../config/supabaseClient');

// 1. GET WALLET DETAILS
exports.getWalletDetails = async (req, res) => {
  try {
    console.log(`[Wallet] Fetching details for User: ${req.user.id}`);
    const { data, error } = await supabase
      .from('profiles')
      .select('wallet_balance, is_monetized, followers_count, total_views, monetization_status')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error(`[Wallet Error]: ${err.message}`);
    res.status(500).json({ success: false, message: "Error fetching wallet" });
  }
};

// 2. TRACK POST VIEW (With Anti-Fraud & Auto-Credit)
exports.trackPostView = async (req, res) => {
  try {
    const { postId } = req.params;
    const viewerId = req.user.id;

    // A. Unique View Check (Fraud Prevention)
    const { data: existingView } = await supabase
      .from('view_logs')
      .select('id')
      .eq('post_id', postId)
      .eq('viewer_id', viewerId)
      .single();

    if (existingView) {
        return res.status(200).json({ message: "View already recorded" });
    }

    // B. Get Post Owner info
    const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).single();
    if (!post) return res.status(404).json({ message: "Post not found" });

    // C. View log karein aur counts badhayein
    await supabase.from('view_logs').insert([{ post_id: postId, viewer_id: viewerId }]);
    await supabase.rpc('increment_post_views', { p_id: postId, u_id: post.user_id });

    // D. 50-50 Revenue logic
    const { data: owner } = await supabase.from('profiles').select('is_monetized, wallet_balance').eq('id', post.user_id).single();

    if (owner && owner.is_monetized) {
      const userShare = 0.05; // 50% of ₹0.10
      
      // Update balance
      await supabase.from('profiles').update({ wallet_balance: owner.wallet_balance + userShare }).eq('id', post.user_id);
      
      // Transaction History save karein
      await supabase.from('transactions').insert([{ 
          user_id: post.user_id, 
          amount: userShare, 
          type: 'earning', 
          description: `Video View Earning (Post #${postId})` 
      }]);
      console.log(`[Revenue] Credited ₹${userShare} to User: ${post.user_id}`);
    }

    res.json({ success: true, message: "View successfully processed" });
  } catch (err) {
    console.error(`[View Error]: ${err.message}`);
    res.status(500).json({ success: false, message: "Internal logic error" });
  }
};

// 3. WITHDRAWAL REQUEST
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, upiId } = req.body;
    if (amount < 500) return res.status(400).json({ message: "Minimum ₹500 required to withdraw" });

    const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', req.user.id).single();

    if (profile.wallet_balance < amount) {
      return res.status(400).json({ message: "Insufficient balance in wallet" });
    }

    // Withdrawal process
    const { error: withdrawErr } = await supabase.from('withdrawals').insert([{ user_id: req.user.id, amount, upi_id: upiId, status: 'pending' }]);
    
    if (!withdrawErr) {
      await supabase.from('profiles').update({ wallet_balance: profile.wallet_balance - amount }).eq('id', req.user.id);
      await supabase.from('transactions').insert([{ user_id: req.user.id, amount: -amount, type: 'withdrawal', status: 'pending' }]);
      console.log(`[Withdrawal] User ${req.user.id} requested ₹${amount}`);
    }

    res.json({ success: true, message: "Withdrawal request submitted!" });
  } catch (err) {
    res.status(500).json({ message: "Withdrawal error" });
  }
};

// 4. GET TRANSACTION HISTORY
exports.getTransactions = async (req, res) => {
    try {
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ message: "Error fetching history" });
    }
};