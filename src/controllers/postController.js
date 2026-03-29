const supabase = require("../config/supabaseClient");
const { convertToHLS } = require("../utils/hlsProcessor");
const { uploadFolder, deleteLocalFolder } = require("../utils/cdnUpload");
const fs = require("fs");
const path = require("path");

let redis;
try {
  redis = require("../config/redisClient");
} catch {
  redis = null;
}

const CDN = "https://yashora-videos.b-cdn.net/";

// ================= CACHE CLEAR =================
const clearFeedCache = async () => {
  if (!redis) return;

  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      MATCH: "feed:*",
      COUNT: 100
    });

    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
    }

  } while (cursor !== "0");
};

// ================= CREATE POST (HLS + CDN) =================
exports.createPost = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Video required"
      });
    }

    const videoId = `video_${Date.now()}`;
    const outputDir = path.join(__dirname, "../../hls", videoId);

    fs.mkdirSync(outputDir, { recursive: true });

    // 🔥 STEP 1: HLS CONVERT
    await convertToHLS(file.path, outputDir);

    // 🔥 STEP 2: CDN UPLOAD
    await uploadFolder(outputDir, videoId);

    // 🔥 STEP 3: DELETE LOCAL FILES
    deleteLocalFolder(outputDir);
    fs.unlinkSync(file.path);

    // 🔥 FINAL HLS URL
    const hls_url = `${CDN}${videoId}/master.m3u8`;

    // 🔥 STEP 4: SAVE DB
    const { data, error } = await supabase
      .from("posts")
      .insert([{
        user_id: req.user.id,
        hls_url,
        description: req.body.description || "",
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

    res.json({
      success: true,
      data
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Upload failed"
    });
  }
};

// ================= GET FEED =================
exports.getFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const cacheKey = `feed:${userId}:page:${page}`;

    // 🔥 REDIS CACHE
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    // 🔥 FETCH POSTS
    const { data: posts } = await supabase
      .from("posts")
      .select(`
        *,
        profiles(id, username, avatar_url)
      `)
      .order("trending_score", { ascending: false })
      .range(from, to);

    // 🔥 FETCH USER LIKES
    const { data: likes } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", userId);

    const likedSet = new Set((likes || []).map(l => l.post_id));

    const finalFeed = (posts || []).map(p => ({
      id: p.id,
      description: p.description,
      hls_url: p.hls_url,
      likes_count: p.likes_count,
      comments_count: p.comments_count,
      views_count: p.views_count,
      user: p.profiles,
      isLiked: likedSet.has(p.id)
    }));

    const response = {
      success: true,
      data: finalFeed,
      page,
      hasMore: finalFeed.length === limit
    };

    if (redis) {
      await redis.setEx(cacheKey, 60, JSON.stringify(response));
    }

    res.json(response);

  } catch (err) {
    console.error("FEED ERROR:", err);

    res.status(500).json({
      success: false
    });
  }
};

// ================= LIKE =================
exports.toggleLike = async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;

    const { data: existing } = await supabase
      .from("likes")
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
      await supabase.from("likes").insert([
        { post_id: postId, user_id: userId }
      ]);
      await supabase.rpc("increment_likes", { row_id: postId });
      liked = true;
    }

    await clearFeedCache();

    req.io?.emit("likeUpdated", { postId, userId, liked });

    res.json({
      success: true,
      liked
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

// ================= VIEW =================
exports.addView = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    const key = `view:${userId}:${postId}`;

    if (redis) {
      const exists = await redis.get(key);
      if (exists) {
        return res.json({ success: true, counted: false });
      }

      await redis.setEx(key, 86400, "1");
    }

    await supabase.rpc("increment_views", { row_id: postId });

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

// ================= COMMENT =================
exports.addComment = async (req, res) => {
  try {
    const { comment_text } = req.body;

    const { data } = await supabase
      .from("comments")
      .insert([{
        post_id: req.params.postId,
        user_id: req.user.id,
        comment_text
      }])
      .select(`
        *,
        profiles(username, avatar_url)
      `)
      .single();

    await supabase.rpc("increment_comments", {
      row_id: req.params.postId
    });

    await clearFeedCache();

    req.io?.emit("commentAdded", data);

    res.json({
      success: true,
      data
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};