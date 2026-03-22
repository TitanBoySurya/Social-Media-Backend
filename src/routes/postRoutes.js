const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const verifyToken = require("../middleware/authMiddleware");
const redis = require("../config/redisClient");

// ==========================================
// SOCKET.IO
// ==========================================
router.use((req, res, next) => {
  req.io = req.app.get("io");
  next();
});

// ==========================================
// 🧹 CLEAR FEED CACHE
// ==========================================
const clearFeedCache = async (userId) => {
  try {
    if (!redis) return;

    const pattern = `feed:${userId}:page:*`;
    let cursor = 0;

    do {
      const result = await redis.scan(cursor, {
        MATCH: pattern,
        COUNT: 50,
      });

      cursor = result.cursor;
      if (result.keys.length > 0) {
        await redis.del(result.keys);
      }

    } while (cursor !== 0);

  } catch (e) {
    console.log("Cache clear error:", e.message);
  }
};

// ==========================================
// 1️⃣ SAVE VIDEO
// ==========================================
router.post("/save", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { video_url, description } = req.body;

    if (!video_url)
      return res.status(400).json({ success: false, message: "Video URL required" });

    const { data, error } = await supabase.from("posts")
      .insert([{
        user_id: userId,
        video_url,
        description: description || "Reel",
        likes_count: 0,
        comments_count: 0,
        views_count: 0
      }]).select();

    if (error) throw error;

    await clearFeedCache(userId);

    req.io?.emit("newPost", data[0]);

    res.json({ success: true, data: data[0] });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2️⃣ FEED (🔥 REDIS OPTIMIZED)
// ==========================================
router.get(["/feed", "/all"], verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const cacheKey = `feed:${userId}:page:${page}`;

    // ⚡ CACHE
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log("⚡ CACHE HIT");
        return res.json(JSON.parse(cached));
      }
    }

    console.log("🐢 DB HIT");

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: posts } = await supabase.from("posts")
      .select(`*, profiles(id, username, avatar_url)`)
      .order("created_at", { ascending: false })
      .range(from, to);

    const { data: likes } = await supabase.from("likes")
      .select("post_id")
      .eq("user_id", userId);

    const likedSet = new Set(likes?.map(l => l.post_id));

    const { data: follows } = await supabase.from("follows")
      .select("following_id")
      .eq("follower_id", userId);

    const followSet = new Set(follows?.map(f => f.following_id));

    const { data: followCounts } = await supabase
      .from("follows")
      .select("following_id");

    const countMap = {};
    followCounts?.forEach(f => {
      countMap[f.following_id] = (countMap[f.following_id] || 0) + 1;
    });

    const finalFeed = posts.map(post => ({
      ...post,
      isLiked: likedSet.has(post.id),
      isFollowing: followSet.has(post.user_id),
      followersCount: countMap[post.user_id] || 0
    }));

    const responseData = {
      success: true,
      data: finalFeed,
      hasMore: posts.length === limit
    };

    if (redis) {
      await redis.setEx(cacheKey, 60, JSON.stringify(responseData));
    }

    res.json(responseData);

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 3️⃣ LIKE
// ==========================================
router.post("/toggle-like/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    const { data: existing } = await supabase.from("likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    let liked;

    if (existing) {
      await supabase.from("likes").delete().eq("id", existing.id);
      liked = false;
    } else {
      await supabase.from("likes")
        .insert([{ post_id: postId, user_id: userId }]);
      liked = true;
    }

    await clearFeedCache(userId);

    req.io?.emit("likeUpdated", { postId, liked });

    res.json({ success: true, liked });

  } catch {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 4️⃣ FOLLOW
// ==========================================
router.post("/follow/toggle/:userId", verifyToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.userId;

    if (followerId === followingId)
      return res.status(400).json({ success: false });

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
      await supabase.from("follows")
        .insert([{ follower_id: followerId, following_id: followingId }]);
      following = true;
    }

    const { count } = await supabase.from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", followingId);

    await clearFeedCache(followerId);

    req.io?.emit("followUpdated", {
      followerId,
      followingId,
      following,
      followersCount: count || 0
    });

    res.json({
      success: true,
      following,
      followersCount: count || 0
    });

  } catch {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 5️⃣ COMMENT
// ==========================================
router.post("/comment/:postId", verifyToken, async (req, res) => {
  try {
    const { comment_text } = req.body;

    if (!comment_text)
      return res.status(400).json({ success: false });

    const { data } = await supabase.from("comments")
      .insert([{
        post_id: req.params.postId,
        user_id: req.user.id,
        comment_text
      }])
      .select(`*, profiles(username, avatar_url)`)
      .single();

    await clearFeedCache(req.user.id);

    req.io?.emit("commentAdded", {
      postId: req.params.postId,
      comment: data
    });

    res.json({ success: true, data });

  } catch {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 6️⃣ VIEW COUNT
// ==========================================
router.post("/view/:postId", async (req, res) => {
  try {
    await supabase.rpc("increment_views", {
      row_id: req.params.postId
    });

    res.json({ success: true });

  } catch {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 7️⃣ SEARCH
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
// 8️⃣ DELETE POST
// ==========================================
router.delete("/delete-post/:postId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    const { data: post } = await supabase.from("posts")
      .select("video_url")
      .eq("id", postId)
      .eq("user_id", userId)
      .single();

    if (!post)
      return res.status(403).json({ success: false });

    const fileName = post.video_url.split("/").pop();

    await supabase.storage.from("videos").remove([fileName]);

    await supabase.from("posts").delete().eq("id", postId);

    await clearFeedCache(userId);

    req.io?.emit("postDeleted", { postId });

    res.json({ success: true });

  } catch {
    res.status(500).json({ success: false });
  }
});

// ==========================================
module.exports = router;