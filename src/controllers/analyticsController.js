const supabase = require("../config/supabaseClient");
const redis = require("../config/redisClient");

exports.trackView = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;
    const cacheKey = `view_lock:${userId}:${postId}`;

    // 🚫 Fake views rokhne ke liye Redis 24h lock
    if (redis) {
      const isViewed = await redis.get(cacheKey);
      if (isViewed) return res.json({ success: true, message: "Already counted", counted: false });
      await redis.setEx(cacheKey, 86400, "1"); // 24 hours lock
    }

    // 1. Database mein View badhao (RPC)
    await supabase.rpc("increment_views", { row_id: postId });

    // 2. Creator ki earning calculate karo (Ad Revenue)
    const { data: post } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .single();

    if (post) {
      const CPM = 50; // ₹50 per 1000 views
      const earningAmount = CPM / 1000;

      await supabase.from("earnings").insert([{
        user_id: post.user_id,
        post_id: postId,
        amount: earningAmount,
        source: "ad_view",
        creator_share: earningAmount * 0.5, // 50% Creator ko
        platform_share: earningAmount * 0.5 // 50% Platform ko
      }]);
    }

    res.json({ success: true, message: "View tracked & earning added", counted: true });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false });
  }
};