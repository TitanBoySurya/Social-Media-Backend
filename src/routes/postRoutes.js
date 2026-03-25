const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const verifyToken = require("../middleware/authMiddleware");
const redis = require("../config/redisClient");
const calculateTrendingScore = require("../utils/trendingScore");

// ================= SOCKET MIDDLEWARE =================
router.use((req, res, next) => {
  req.io = req.app.get("io");
  next();
});

// ================= SAFE FEED CACHE CLEAR =================
const clearFeedCache = async () => {
  try {
    if (!redis) return;

    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        MATCH: "feed:*",
        COUNT: 100
      });
      cursor = nextCursor;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
  } catch (err) {
    console.log("Cache Clear Error:", err.message);
  }
};

// ================= SAVE VIDEO =================
router.post("/save", verifyToken, async (req, res) => {
  try {
    const { video_url, description } = req.body;
    if (!video_url)
      return res.status(400).json({ success: false, message: "Video URL required" });

    const { data, error } = await supabase.from("posts")
      .insert([{
        user_id: req.user.id,
        video_url,
        description: description || "Reel",
        likes_count: 0,
        comments_count: 0,
        views_count: 0,
        trending_score: 0
      }])
      .select()
      .single();

    if (error) throw error;

    await clearFeedCache();
    req.io?.emit("newPost", data);
    res.json({ success: true, data });

  } catch (err) {
    console.error("SAVE ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// ================= FEED =================
router.get("/feed", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const cacheKey = `feed:${userId}:page:${page}`;

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    }

    const { data: posts, error } = await supabase.from("posts")
      .select(`*, profiles(id, username, avatar_url)`)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;

    const { data: likes } = await supabase.from("likes")
      .select("post_id")
      .eq("user_id", userId);
    const likedSet = new Set((likes || []).map(l => l.post_id));

    const finalFeed = (posts || []).map(p => ({
      ...p,
      isLiked: likedSet.has(p.id)
    }));

    const response = { success: true, data: finalFeed, page, hasMore: finalFeed.length === limit };

    if (redis) await redis.setEx(cacheKey, 60, JSON.stringify(response));

    res.json(response);

  } catch (err) {
    console.error("FEED ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// ================= LIKE / TOGGLE =================
router.post("/toggle-like/:postId", verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const { data: existing } = await supabase.from("likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    let liked;
    if (existing) {
      await supabase.from("likes").delete().eq("id", existing.id);
      await supabase.rpc("decrement_likes", { row_id: postId });
      liked = false;
    } else {
      await supabase.from("likes").insert([{ post_id: postId, user_id: userId }]);
      await supabase.rpc("increment_likes", { row_id: postId });
      liked = true;
    }

    req.io?.emit("likeUpdated", { postId, userId, liked });
    res.json({ success: true, liked });

  } catch (err) {
    console.error("LIKE ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// ================= VIEW (ANTI-FAKE + TRENDING + EARNINGS) =================
router.post("/view/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;
    const key = `view:${userId}:${postId}`;

    if (redis) {
      const exists = await redis.get(key);
      if (exists) return res.json({ success: true, counted: false });
      await redis.setEx(key, 86400, "1"); // 24h
    }

    await supabase.rpc("increment_views", { row_id: postId });

    const { data: post, error } = await supabase.from("posts")
      .select("*").eq("id", postId).single();
    if (error || !post) return res.json({ success: true, counted: true });

    // Trending score
    const newScore = calculateTrendingScore(post);
    await supabase.from("posts").update({ trending_score: newScore }).eq("id", postId);

    // Monetization
    const CPM = 50;
    const earning = CPM / 1000;
    await supabase.from("earnings").insert([{
      user_id: post.user_id,
      post_id: postId,
      source: "ads",
      amount: earning,
      creator_share: earning * 0.5,
      platform_share: earning * 0.5
    }]);

    res.json({ success: true, counted: true, trending_score: newScore });

  } catch (err) {
    console.error("VIEW ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// ================= COMMENT =================
router.post("/comment/:postId", verifyToken, async (req, res) => {
  try {
    const { comment_text } = req.body;
    if (!comment_text || comment_text.trim() === "")
      return res.status(400).json({ success: false, message: "Empty comment" });

    const { data, error } = await supabase.from("comments")
      .insert([{ post_id: req.params.postId, user_id: req.user.id, comment_text }])
      .select(`*, profiles(username, avatar_url)`)
      .single();
    if (error) throw error;

    await supabase.rpc("increment_comments", { row_id: req.params.postId });

    req.io?.emit("commentAdded", { postId: req.params.postId, comment: data });
    res.json({ success: true, data });

  } catch (err) {
    console.error("COMMENT ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// ================= FOLLOW / UNFOLLOW =================
router.post("/follow/toggle/:userId", verifyToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.userId;
    if (followerId === followingId) return res.status(400).json({ success: false });

    const { data: existing } = await supabase.from("follows")
      .select("id")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle();

    let following;
    if (existing) {
      await supabase.from("follows").delete().eq("id", existing.id);
      following = false;
    } else {
      await supabase.from("follows").insert([{ follower_id: followerId, following_id: followingId }]);
      following = true;
    }

    req.io?.emit("followUpdated", { followerId, followingId, following });
    res.json({ success: true, following });

  } catch (err) {
    console.error("FOLLOW ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// ================= SEARCH =================
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
  } catch (err) {
    console.error("SEARCH ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// ================= DELETE POST =================
router.delete("/delete-post/:postId", verifyToken, async (req, res) => {
  try {
    const postId = req.params.postId;
    const { data: post } = await supabase.from("posts")
      .select("video_url")
      .eq("id", postId)
      .eq("user_id", req.user.id)
      .single();

    if (!post) return res.status(403).json({ success: false });

    const fileName = post.video_url.split("/").pop();
    await supabase.storage.from("videos").remove([fileName]);
    await supabase.from("posts").delete().eq("id", postId);

    await clearFeedCache();
    req.io?.emit("postDeleted", { postId });
    res.json({ success: true });

  } catch (err) {
    console.error("DELETE ERROR:", err.message);
    res.status(500).json({ success: false });
  }
});

// ================= MY POSTS =================
router.get("/my-posts", verifyToken, async (req, res) => {
  const { data } = await supabase.from("posts")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });
  res.json({ success: true, data });
});

// ================= TRENDING FEED =================
router.get("/trending", async (req, res) => {
  try {
    const { data, error } = await supabase.from("posts")
      .select(`*, profiles(username, avatar_url)`)
      .order("trending_score", { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;