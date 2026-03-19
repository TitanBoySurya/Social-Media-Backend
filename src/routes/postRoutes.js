const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const verifyToken = require("../middleware/authMiddleware");

// 🚀 SAVE VIDEO
router.post("/save", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { video_url, description } = req.body;
    if (!video_url) return res.status(400).json({ success: false, message: "Video URL missing" });

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

// ❤️ TOGGLE LIKE
router.post("/toggle-like/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    const { data: existing } = await supabase
      .from("likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId);
      await supabase.rpc("decrement_likes", { row_id: postId });
      if (req.io) req.io.emit("likeUpdated", { postId, userId, liked: false });
      return res.json({ success: true, liked: false });
    }

    await supabase.from("likes").insert([{ post_id: postId, user_id: userId }]);
    await supabase.rpc("increment_likes", { row_id: postId });
    if (req.io) req.io.emit("likeUpdated", { postId, userId, liked: true });
    res.json({ success: true, liked: true });
  } catch (err) {
    console.error("LIKE ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// 🏠 HOME FEED (Supports both /feed and /all to fix 404)
router.get(["/feed", "/all"], verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: posts, error } = await supabase
      .from("posts")
      .select(`*, profiles(username, avatar_url)`)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const { data: likes } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", userId);

    const likedSet = new Set(likes.map(l => l.post_id));

    const finalFeed = posts.map(post => ({
      ...post,
      isLiked: likedSet.has(post.id)
    }));

    res.json({ success: true, data: finalFeed, page, limit });
  } catch (err) {
    console.error("FEED ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// 👤 MY POSTS
router.get("/my-posts", verifyToken, async (req, res) => {
  try {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false });
  }
});

// 📊 MY STATS
router.get("/my-stats", verifyToken, async (req, res) => {
  try {
    const { count } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.user.id);
    res.json({ success: true, posts: count || 0 });
  } catch {
    res.status(500).json({ success: false });
  }
});

// 🔍 GLOBAL SEARCH
router.get("/search/:query", verifyToken, async (req, res) => {
  try {
    const query = req.params.query;
    const { data: users } = await supabase.from("profiles").select("id, username, avatar_url").ilike("username", `%${query}%`);
    const { data: videos } = await supabase.from("posts").select(`*, profiles(username, avatar_url)`).ilike("description", `%${query}%`);
    res.json({ success: true, users, videos });
  } catch {
    res.status(500).json({ success: false });
  }
});

module.exports = router;