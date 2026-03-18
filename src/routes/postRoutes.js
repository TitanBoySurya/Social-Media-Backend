const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const verifyToken = require("../middleware/authMiddleware");

// =================================
// 🚀 1. SAVE VIDEO LINK (New Route for your Android Logic)
// Use this: Android sends URL -> Backend saves to DB
// =================================
router.post("/save", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { video_url, description } = req.body; // Android se ye data aayega

    if (!video_url) {
      return res.status(400).json({ success: false, message: "Video URL is missing" });
    }

    const { data: postData, error: dbError } = await supabase
      .from("posts")
      .insert([
        {
          user_id: userId,
          video_url: video_url,
          description: description || "Yashora Reel"
        }
      ])
      .select();

    if (dbError) throw dbError;

    res.status(200).json({
      success: true,
      message: "Video saved successfully!",
      data: postData
    });

  } catch (error) {
    console.error("❌ Save Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =================================
// 📁 2. DIRECT VIDEO UPLOAD (Your existing Multer logic)
// =================================
router.post("/upload", verifyToken, async (req, res) => {
  const upload = req.app.get("upload").single("video");

  upload(req, res, async (err) => {
    if (err) return res.status(500).json({ success: false, message: "File upload error" });
    
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: "No video file provided" });

    try {
      const userId = req.user?.id;
      const fileName = `yashora_${userId}_${Date.now()}.mp4`;

      // Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from("yashora-videos")
        .upload(fileName, file.buffer, { contentType: "video/mp4" });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage.from("yashora-videos").getPublicUrl(fileName);
      const videoUrl = urlData.publicUrl;

      // Save to Database
      const { data: postData, error: dbError } = await supabase
        .from("posts")
        .insert([{ user_id: userId, video_url: videoUrl, description: req.body.description || "Yashora Reel" }])
        .select();

      if (dbError) throw dbError;

      res.status(200).json({ success: true, video_url: videoUrl });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
});

// =================================
// 🏠 3. HOME FEED & OTHER ROUTES (Keep as it is)
// =================================
router.get("/all", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error } = await supabase
      .from("posts")
      .select(`*, profiles (username, avatar_url)`)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    res.status(200).json({ success: true, page, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase.from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user?.id;
    const { data: post, error } = await supabase.from("posts").select("video_url").eq("id", postId).single();
    if (error) throw error;

    const fileName = post.video_url.split("/").pop();
    await supabase.storage.from("yashora-videos").remove([fileName]);
    await supabase.from("posts").delete().eq("id", postId).eq("user_id", userId);

    res.json({ success: true, message: "Post deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;