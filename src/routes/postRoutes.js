const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const verifyToken = require("../middleware/authMiddleware");

// 🚀 1. SAVE VIDEO LINK (For Supabase Storage + Render logic)
router.post("/save", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { video_url, description } = req.body;

    if (!video_url) {
      return res.status(400).json({ success: false, message: "Video URL is missing" });
    }

    const { data: postData, error: dbError } = await supabase
      .from("posts")
      .insert([{ user_id: userId, video_url, description: description || "Yashora Reel" }])
      .select();

    if (dbError) throw dbError;
    res.status(200).json({ success: true, message: "Video saved successfully!", data: postData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ❤️ 2. UPDATE LIKES (Fixed: Ab refresh par data nahi jayega)
router.post("/update-likes/:postId", async (req, res) => {
  try {
    const { postId } = req.params;
    const { count } = req.query; // Android bhej raha hai ?count=X

    const { data, error } = await supabase
      .from("posts")
      .update({ likes_count: parseInt(count) })
      .eq("id", postId)
      .select();

    if (error) throw error;
    res.status(200).json({ success: true, message: "Likes updated", data });
  } catch (error) {
    console.error("❌ Like Update Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🏠 3. GET ALL VIDEOS (Home Feed)
router.get("/all", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const from = (page - 1) * limit;
    const { data, error } = await supabase
      .from("posts")
      .select(`*, profiles (username, avatar_url)`)
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 📁 OTHER ROUTES (User Videos & Delete)
router.get("/user/:userId", async (req, res) => {
  try {
    const { data, error } = await supabase.from("posts").select("*").eq("user_id", req.params.userId);
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { data: post } = await supabase.from("posts").select("video_url").eq("id", req.params.id).single();
    if (post) {
      const fileName = post.video_url.split("/").pop();
      await supabase.storage.from("yashora-videos").remove([fileName]);
    }
    await supabase.from("posts").delete().eq("id", req.params.id).eq("user_id", req.user.id);
    res.json({ success: true, message: "Post deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  } 
});

module.exports = router;