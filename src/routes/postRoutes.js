const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const verifyToken = require("../middleware/authMiddleware"); // 👈 1. Middleware import kiya

// 🎥 1. Video Upload Route (Ab Secure hai)
router.post("/upload", verifyToken, async (req, res) => { // 👈 2. verifyToken yahan lagaya
    const upload = req.app.get("upload").single("video");

    upload(req, res, async (err) => {
        if (err) {
            console.error("🔥 Multer Error:", err);
            return res.status(500).json({ success: false, message: "Multer Error" });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, message: "No video file provided" });
        }

        try {
            // 3. req.user middleware se aa raha hai
            const userId = req.user.id; 
            const fileName = `yashora_${userId}_${Date.now()}.mp4`;

            // ☁️ A. Supabase Storage upload
            const { data, error: storageError } = await supabase.storage
                .from('yashora-videos')
                .upload(fileName, file.buffer, {
                    contentType: 'video/mp4',
                    upsert: false
                });

            if (storageError) throw storageError;

            // 🔗 B. Public URL
            const { data: urlData } = supabase.storage
                .from('yashora-videos')
                .getPublicUrl(fileName);

            const videoUrl = urlData.publicUrl;

            // 📝 C. Database entry (Ab user_id ke saath)
            const { error: dbError } = await supabase
                .from('posts')
                .insert([
                    {
                        video_url: videoUrl,
                        description: req.body.description || "Yashora Reel",
                        user_id: userId, // 👈 4. Video ko user se link kiya
                        created_at: new Date()
                    }
                ]);

            if (dbError) throw dbError;

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

// 📱 2. Get All Videos Route (Ye public reh sakta hai)
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