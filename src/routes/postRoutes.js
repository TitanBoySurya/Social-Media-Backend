const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const verifyToken = require("../middleware/authMiddleware");


// 🚀 1. SAVE VIDEO
router.post("/save", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { video_url, description } = req.body;

    if (!userId) return res.status(401).json({ success: false });
    if (!video_url) return res.status(400).json({ success: false, message: "URL missing" });

    const { data, error } = await supabase
      .from("posts")
      .insert([{
        user_id: userId,
        video_url,
        description: description || "Yashora Reel",
        likes_count: 0,
        comments_count: 0,
        views_count: 0
      }])
      .select();

    if (error) throw error;

    res.json({ success: true, data });

  } catch (err) {
    console.error("SAVE ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});


// ❤️ 2. TOGGLE LIKE (SAFE + ATOMIC)
router.post("/toggle-like/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    // check like
    const { data: existing } = await supabase
      .from("likes")
      .select("*")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      // ❌ UNLIKE
      await supabase
        .from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);

      await supabase.rpc("decrement_likes", { row_id: postId });

      return res.json({ success: true, liked: false });

    } else {
      // ❤️ LIKE
      await supabase
        .from("likes")
        .insert([{ post_id: postId, user_id: userId }]);

      await supabase.rpc("increment_likes", { row_id: postId });

      return res.json({ success: true, liked: true });
    }

  } catch (err) {
    console.error("LIKE ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});


// 💬 3. ADD COMMENT
router.post("/comment/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;
    const { comment_text } = req.body;

    if (!comment_text) {
      return res.status(400).json({ success: false, message: "Empty comment" });
    }

    const { data, error } = await supabase
      .from("comments")
      .insert([{ post_id: postId, user_id: userId, comment_text }])
      .select(`*, profiles(username, avatar_url)`)
      .single();

    if (error) throw error;

    // ✅ increment comment count
    await supabase.rpc("increment_comments", { row_id: postId });

    res.json({ success: true, data });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// 👁️ 4. VIEW COUNT
router.post("/view/:postId", async (req, res) => {
  try {
    const postId = req.params.postId;

    await supabase.rpc("increment_views", { row_id: postId });

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// 🏠 5. HOME FEED (PAGINATION)
router.get("/all", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const from = (page - 1) * limit;

    const { data, error } = await supabase
      .from("posts")
      .select(`*, profiles(username, avatar_url)`)
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);

    if (error) throw error;

    res.json({ success: true, data });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// 👤 6. USER VIDEOS
router.get("/user/:userId", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", req.params.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, data });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// 🗑 7. DELETE POST
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    const { data: post } = await supabase
      .from("posts")
      .select("video_url")
      .eq("id", postId)
      .single();

    if (post) {
      const file = post.video_url.split("/").pop();
      await supabase.storage.from("yashora-videos").remove([file]);
    }

    await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", userId);

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// 💬 8. GET COMMENTS
router.get("/comments/:postId", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("comments")
      .select(`*, profiles(username, avatar_url)`)
      .eq("post_id", req.params.postId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, data });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;