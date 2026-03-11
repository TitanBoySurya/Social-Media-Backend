const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");

// 🎥 1. Video Upload Route
// Android App isi URL par hit karegi: https://your-url.com/api/posts/upload
router.post("/upload", async (req, res) => {
    // server.js mein jo 'upload' set kiya tha use yahan call karte hain
    const upload = req.app.get("upload").single("video");

    upload(req, res, async (err) => {
        if (err) {
            console.error("🔥 Multer Error:", err);
            return res.status(500).json({ success: false, message: "Multer Error: File upload failed" });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, message: "No video file provided" });
        }

        try {
            // Unique file name banana (Example: yashora_1710150000.mp4)
            const fileName = `yashora_${Date.now()}.mp4`;

            // ☁️ A. Supabase Storage mein upload karein
            const { data, error: storageError } = await supabase.storage
                .from('yashora-videos') // 👈 Make sure bucket name is exact!
                .upload(fileName, file.buffer, {
                    contentType: 'video/mp4',
                    upsert: false
                });

            if (storageError) throw storageError;

            // 🔗 B. Public URL hasil karein
            const { data: urlData } = supabase.storage
                .from('yashora-videos')
                .getPublicUrl(fileName);

            const videoUrl = urlData.publicUrl;

            // 📝 C. Database (posts table) mein entry karein
            const { error: dbError } = await supabase
                .from('posts')
                .insert([
                    {
                        video_url: videoUrl,
                        description: req.body.description || "Yashora Reel",
                        created_at: new Date()
                    }
                ]);

            if (dbError) throw dbError;

            // 🎉 D. Success Response
            console.log("✅ Video Uploaded Successfully:", videoUrl);
            res.status(200).json({
                success: true,
                message: "Video live on Yashora!",
                url: videoUrl
            });

        } catch (error) {
            console.error("❌ Backend Error:", error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    });
});

// 📱 2. Get All Videos Route (Reels dikhane ke liye)
router.get("/all", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;