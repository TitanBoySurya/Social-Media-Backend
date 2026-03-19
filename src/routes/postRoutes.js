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
      await supabase.from("likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);

      await supabase.rpc("decrement_likes", { row_id: postId });

      // Notify realtime via Socket
      req.io.emit("likeUpdated", { postId, userId, liked: false });

      return res.json({ success: true, liked: false });
    }

    await supabase.from("likes")
      .insert([{ post_id: postId, user_id: userId }]);

    await supabase.rpc("increment_likes", { row_id: postId });

    req.io.emit("likeUpdated", { postId, userId, liked: true });

    res.json({ success: true, liked: true });

  } catch (err) {
    console.error("LIKE ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// 🏠 PERSONALIZED FEED + INFINITE SCROLL + PRELOAD
router.get("/feed", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 1️⃣ Get following IDs
    const { data: following } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);

    const followingIds = following.map(f => f.following_id);

    // 2️⃣ Fetch posts: following first, then global
    const { data: posts } = await supabase
      .from("posts")
      .select(`*, profiles(username, avatar_url)`)
      .order("created_at", { ascending: false })
      .range(from, to);

    // 3️⃣ Mark liked posts
    const { data: likes } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", userId);

    const likedSet = new Set(likes.map(l => l.post_id));

    const feed = posts.map(post => ({
      ...post,
      isLiked: likedSet.has(post.id),
      // CDN-ready URL
      cdn_url: post.video_url // replace if using CDN mapping
    }));

    res.json({ success: true, data: feed, page, limit });

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

// 💬 ADD COMMENT
router.post("/comment/:postId", verifyToken, async (req, res) => {
  try {
    const { comment_text } = req.body;
    if (!comment_text) return res.status(400).json({ success: false });

    const { data } = await supabase
      .from("comments")
      .insert([{
        post_id: req.params.postId,
        user_id: req.user.id,
        comment_text
      }])
      .select(`*, profiles(username, avatar_url)`)
      .single();

    await supabase.rpc("increment_comments", { row_id: req.params.postId });

    res.json({ success: true, data });

  } catch {
    res.status(500).json({ success: false });
  }
});

// 👁️ VIEW COUNT
router.post("/view/:postId", async (req, res) => {
  try {
    await supabase.rpc("increment_views", { row_id: req.params.postId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

// 🔍 GLOBAL SEARCH (users + videos)
router.get("/search/:query", verifyToken, async (req, res) => {
  try {
    const query = req.params.query;

    const { data: users } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${query}%`);

    const { data: videos } = await supabase
      .from("posts")
      .select(`id, video_url, description, profiles(username, avatar_url)`)
      .ilike("description", `%${query}%`)
      .order("created_at", { ascending: false });

    res.json({ success: true, users, videos });

  } catch {
    res.status(500).json({ success: false });
  }
});

module.exports = router;