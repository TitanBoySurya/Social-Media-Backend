const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const verifyToken = require("../middleware/authMiddleware");

// ==========================================
// Socket.io instance middleware
// ==========================================
router.use((req, res, next) => {
  req.io = req.app.get("io"); // Express app me io set karna zaroori hai
  next();
});

// ==========================================
// 1️⃣ SAVE VIDEO
// ==========================================
router.post("/save", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { video_url, description } = req.body;
    if (!video_url) return res.status(400).json({ success: false, message: "Video URL missing" });

    const { data, error } = await supabase.from("posts")
      .insert([{ user_id: userId, video_url, description: description || "Bharat Social Reel", likes_count: 0, comments_count: 0, views_count: 0 }])
      .select();

    if (error) throw error;

    if (req.io) req.io.emit("newPost", { post: data[0] }); // Real-time feed update
    res.json({ success: true, data: data[0] });
  } catch (err) {
    console.error("SAVE ERROR:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2️⃣ TOGGLE LIKE (Real-time)
// ==========================================
router.post("/toggle-like/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    const { data: existing } = await supabase.from("likes")
      .select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle();

    let liked = false;
    if (existing) {
      await supabase.from("likes").delete().eq("id", existing.id);
      await supabase.rpc("decrement_likes", { row_id: postId });
      liked = false;
    } else {
      await supabase.from("likes").insert([{ post_id: postId, user_id: userId }]);
      await supabase.rpc("increment_likes", { row_id: postId });
      liked = true;
    }

    if (req.io) req.io.emit("likeUpdated", { postId, userId, liked });
    res.json({ success: true, liked });
  } catch (err) {
    console.error("LIKE ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 3️⃣ GLOBAL FEED (Infinite Scroll Ready)
// ==========================================
router.get(["/all", "/feed"], verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: posts, error } = await supabase.from("posts")
      .select(`*, profiles(username, avatar_url)`)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const { data: userLikes } = await supabase.from("likes")
      .select("post_id").eq("user_id", userId);
    const likedSet = new Set(userLikes?.map(l => l.post_id) || []);

    const finalFeed = posts.map(post => ({ ...post, isLiked: likedSet.has(post.id) }));

    res.json({ success: true, data: finalFeed, page, limit, hasMore: posts.length === limit });
  } catch (err) {
    console.error("FEED ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 4️⃣ FOLLOW / UNFOLLOW (Real-time)
// ==========================================
router.post("/follow/toggle/:userId", verifyToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.userId;
    if (followerId === followingId) return res.status(400).json({ success: false, message: "Cannot follow yourself" });

    const { data: existing } = await supabase.from("follows")
      .select("id").eq("follower_id", followerId).eq("following_id", followingId).maybeSingle();

    let following = false;
    if (existing) {
      await supabase.from("follows").delete().eq("id", existing.id);
      following = false;
    } else {
      await supabase.from("follows").insert([{ follower_id: followerId, following_id: followingId }]);
      following = true;
    }

    if (req.io) req.io.emit("followUpdated", { followerId, followingId, following });
    res.json({ success: true, following });
  } catch (err) {
    console.error("FOLLOW ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// 👥 GET FOLLOWERS
router.get("/followers/:userId", async (req, res) => {
  try {
    const { data } = await supabase.from("follows")
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
    const { data } = await supabase.from("follows")
      .select(`following_id, profiles(username, avatar_url)`)
      .eq("follower_id", req.params.userId);
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 5️⃣ COMMENTS & VIEWS (Real-time)
// ==========================================
router.post("/comment/:postId", verifyToken, async (req, res) => {
  try {
    const { comment_text } = req.body;
    if (!comment_text || comment_text.trim() === "")
      return res.status(400).json({ success: false, message: "Comment cannot be empty" });

    const { data, error } = await supabase.from("comments")
      .insert([{ post_id: req.params.postId, user_id: req.user.id, comment_text }])
      .select(`*, profiles(username, avatar_url)`).single();

    if (error) throw error;
    await supabase.rpc("increment_comments", { row_id: req.params.postId });

    if (req.io) req.io.emit("commentAdded", { postId: req.params.postId, userId: req.user.id, comment: data });
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false });
  }
});

router.post("/view/:postId", async (req, res) => {
  try {
    await supabase.rpc("increment_views", { row_id: req.params.postId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 6️⃣ SEARCH (Users + Videos)
// ==========================================
router.get("/search/:query", verifyToken, async (req, res) => {
  try {
    const q = req.params.query;
    const { data: users } = await supabase.from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${q}%`);

    const { data: videos } = await supabase.from("posts")
      .select(`*, profiles(username, avatar_url)`)
      .ilike("description", `%${q}%`);

    res.json({ success: true, users, videos });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 7️⃣ DELETE POST (Owner + Storage)
// ==========================================
router.delete("/delete-post/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    const { data: post } = await supabase.from("posts")
      .select("video_url").eq("id", postId).eq("user_id", userId).single();

    if (!post) return res.status(403).json({ success: false, message: "Unauthorized or post not found" });

    // Delete storage
    const fileName = post.video_url.split('/').pop();
    await supabase.storage.from("videos").remove([fileName]);

    // Delete DB record
    await supabase.from("posts").delete().eq("id", postId);

    if (req.io) req.io.emit("postDeleted", { postId, userId });
    res.json({ success: true, message: "Post deleted successfully" });
  } catch (err) {
    console.error("DELETE ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 8️⃣ MY POSTS / STATS
// ==========================================
router.get("/my-posts", verifyToken, async (req, res) => {
  const { data } = await supabase.from("posts")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });
  res.json({ success: true, data });
});

router.get("/my-stats", verifyToken, async (req, res) => {
  const { count } = await supabase.from("posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", req.user.id);
  res.json({ success: true, postsCount: count || 0 });
});

module.exports = router;