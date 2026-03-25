const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const verifyToken = require("../middleware/authMiddleware");


// ❤️ FOLLOW / UNFOLLOW (TOGGLE)
router.post("/toggle/:userId", verifyToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.userId;

    if (!followingId) {
      return res.status(400).json({ success: false, message: "User ID missing" });
    }

    if (followerId === followingId) {
      return res.status(400).json({
        success: false,
        message: "Cannot follow yourself"
      });
    }

    // 🔍 CHECK EXISTING FOLLOW
    const { data: existing, error: fetchError } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle();

    if (fetchError) {
      console.error("FETCH ERROR:", fetchError.message);
      return res.status(500).json({ success: false });
    }

    if (existing) {
      // ❌ UNFOLLOW
      const { error: deleteError } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", followerId)
        .eq("following_id", followingId);

      if (deleteError) {
        console.error("UNFOLLOW ERROR:", deleteError.message);
        return res.status(500).json({ success: false });
      }

      return res.json({
        success: true,
        following: false
      });
    }

    // ❤️ FOLLOW
    const { error: insertError } = await supabase
      .from("follows")
      .insert([
        {
          follower_id: followerId,
          following_id: followingId
        }
      ]);

    if (insertError) {
      console.error("FOLLOW ERROR:", insertError.message);
      return res.status(500).json({ success: false });
    }

    return res.json({
      success: true,
      following: true
    });

  } catch (err) {
    console.error("FOLLOW ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});


// ✅ FOLLOW STATUS (MOST IMPORTANT FIX)
router.get("/status/:userId", verifyToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.userId;

    const { data, error } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle();

    if (error) {
      console.error("STATUS ERROR:", error.message);
      return res.status(500).json({ success: false });
    }

    return res.json({
      success: true,
      following: !!data
    });

  } catch (err) {
    console.error("STATUS ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});


// 👥 GET FOLLOWERS
router.get("/followers/:userId", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("follows")
      .select(`
        follower_id,
        profiles(username, avatar_url)
      `)
      .eq("following_id", req.params.userId);

    if (error) {
      console.error("FOLLOWERS ERROR:", error.message);
      return res.status(500).json({ success: false });
    }

    res.json({
      success: true,
      data: data || []
    });

  } catch (err) {
    console.error("FOLLOWERS ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});


// 👤 GET FOLLOWING
router.get("/following/:userId", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("follows")
      .select(`
        following_id,
        profiles(username, avatar_url)
      `)
      .eq("follower_id", req.params.userId);

    if (error) {
      console.error("FOLLOWING ERROR:", error.message);
      return res.status(500).json({ success: false });
    }

    res.json({
      success: true,
      data: data || []
    });

  } catch (err) {
    console.error("FOLLOWING ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

module.exports = router;