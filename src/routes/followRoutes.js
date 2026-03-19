const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const verifyToken = require("../middleware/authMiddleware");


// ❤️ FOLLOW / UNFOLLOW (toggle)
router.post("/toggle/:userId", verifyToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.userId;

    if (followerId === followingId) {
      return res.status(400).json({ success: false, message: "Cannot follow yourself" });
    }

    const { data: existing } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle();

    if (existing) {
      // ❌ UNFOLLOW
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", followerId)
        .eq("following_id", followingId);

      return res.json({ success: true, following: false });
    }

    // ❤️ FOLLOW
    await supabase
      .from("follows")
      .insert([{ follower_id: followerId, following_id: followingId }]);

    return res.json({ success: true, following: true });

  } catch (err) {
    console.error("FOLLOW ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});


// 👥 GET FOLLOWERS
router.get("/followers/:userId", async (req, res) => {
  try {
    const { data } = await supabase
      .from("follows")
      .select(`follower_id, profiles(username, avatar_url)`)
      .eq("following_id", req.params.userId);

    res.json({ success: true, data });

  } catch {
    res.status(500).json({ success: false });
  }
});


// 👤 GET FOLLOWING
router.get("/following/:userId", async (req, res) => {
  try {
    const { data } = await supabase
      .from("follows")
      .select(`following_id, profiles(username, avatar_url)`)
      .eq("follower_id", req.params.userId);

    res.json({ success: true, data });

  } catch {
    res.status(500).json({ success: false });
  }
});

module.exports = router;