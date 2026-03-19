const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const verifyToken = require("../middleware/authMiddleware");

// 🚀 1. SAVE VIDEO
router.post("/save", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { video_url, description } = req.body;
    if (!video_url) return res.status(400).json({ success: false, message: "Video URL missing" });

    const { data, error } = await supabase.from("posts").insert([{
      user_id: userId, video_url, description: description || "Bharat Social Reel",
      likes_count: 0, comments_count: 0, views_count: 0
    }]).select();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ❤️ 2. TOGGLE LIKE
router.post("/toggle-like/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;
    const { data: existing } = await supabase.from("likes").select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle();

    if (existing) {
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId);
      await supabase.rpc("decrement_likes", { row_id: postId });
      return res.json({ success: true, liked: false });
    }
    await supabase.from("likes").insert([{ post_id: postId, user_id: userId }]);
    await supabase.rpc("increment_likes", { row_id: postId });
    res.json({ success: true, liked: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

// 🏠 3. HOME FEED (Fixes 404 & adds isLiked)
router.get(["/feed", "/all"], verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: posts, error } = await supabase.from("posts").select(`*, profiles(username, avatar_url)`).order("created_at", { ascending: false }).range(from, to);
    if (error) throw error;

    const { data: likes } = await supabase.from("likes").select("post_id").eq("user_id", userId);
    const likedSet = new Set(likes ? likes.map(l => l.post_id) : []);

    const finalFeed = posts.map(post => ({ ...post, isLiked: likedSet.has(post.id) }));
    res.json({ success: true, data: finalFeed, hasMore: posts.length === limit });
  } catch (err) { res.status(500).json({ success: false }); }
});

// 🔍 4. SEARCH (Users + Videos)
router.get("/search/:query", verifyToken, async (req, res) => {
  const q = req.params.query;
  const { data: users } = await supabase.from("profiles").select("id, username, avatar_url").ilike("username", `%${q}%`);
  const { data: videos } = await supabase.from("posts").select(`*, profiles(username, avatar_url)`).ilike("description", `%${q}%`);
  res.json({ success: true, users, videos });
});

// 🤝 5. FOLLOW / UNFOLLOW
router.post("/follow/toggle/:userId", verifyToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.userId;
    if (followerId === followingId) return res.status(400).json({ success: false });

    const { data: existing } = await supabase.from("follows").select("id").eq("follower_id", followerId).eq("following_id", followingId).maybeSingle();

    if (existing) {
      await supabase.from("follows").delete().eq("follower_id", followerId).eq("following_id", followingId);
      return res.json({ success: true, following: false });
    }
    await supabase.from("follows").insert([{ follower_id: followerId, following_id: followingId }]);
    res.json({ success: true, following: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

// 💬 6. COMMENTS & VIEWS
router.post("/comment/:postId", verifyToken, async (req, res) => {
  const { comment_text } = req.body;
  const { data } = await supabase.from("comments").insert([{ post_id: req.params.postId, user_id: req.user.id, comment_text }]).select(`*, profiles(username, avatar_url)`).single();
  await supabase.rpc("increment_comments", { row_id: req.params.postId });
  res.json({ success: true, data });
});

router.post("/view/:postId", async (req, res) => {
  await supabase.rpc("increment_views", { row_id: req.params.postId });
  res.json({ success: true });
});

// 🗑️ 7. DELETE POST (New Feature)
router.delete("/delete/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    // 1. Check if post belongs to user
    const { data: post } = await supabase.from("posts").select("video_url").eq("id", postId).eq("user_id", userId).single();
    if (!post) return res.status(403).json({ success: false, message: "Unauthorized or post not found" });

    // 2. Delete video from Storage
    const fileName = post.video_url.split('/').pop();
    await supabase.storage.from('videos').remove([fileName]);

    // 3. Delete from Database
    await supabase.from("posts").delete().eq("id", postId);

    res.json({ success: true, message: "Post deleted successfully" });
  } catch (err) { res.status(500).json({ success: false }); }
});

module.exports = router;