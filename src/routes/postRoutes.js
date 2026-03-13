const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const verifyToken = require("../middleware/authMiddleware");

// 🎥 1. Video Upload Route (With Auto-Profile Sync)
router.post("/upload", verifyToken, async (req, res) => {
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
            const userId = req.user.id; 
            const userEmail = req.user.email;
            const userName = req.user.user_metadata?.full_name || "Yashora User";

            // 🛡️ STEP 1: Foreign Key Error Fix (Profile Sync)
            // Check if user exists in public.profiles
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', userId)
                .single();

            if (!profile) {
                console.log("🔄 Syncing new user to profiles table...");
                await supabase.from('profiles').insert([
                    { id: userId, email: userEmail, username: userName }
                ]);
            }

            // ☁️ STEP 2: Storage Upload
            const fileName = `yashora_${userId}_${Date.now()}.mp4`;
            const { data: storageData, error: storageError } = await supabase.storage
                .from('yashora-videos')
                .upload(fileName, file.buffer, {
                    contentType: 'video/mp4',
                    upsert: false
                });

            if (storageError) throw storageError;

            // 🔗 STEP 3: Get Public URL
            const { data: urlData } = supabase.storage
                .from('yashora-videos')
                .getPublicUrl(fileName);

            const videoUrl = urlData.publicUrl;

            // 📝 STEP 4: Database Entry
            const { error: dbError } = await supabase
                .from('posts')
                .insert([
                    {
                        video_url: videoUrl,
                        description: req.body.description || "Yashora Reel",
                        user_id: userId,
                        created_at: new Date()
                    }
                ]);

            if (dbError) throw dbError;

            res.status(200).json({
                success: true,
                message: "Mubarak ho! Video live on Yashora.",
                url: videoUrl
            });

        } catch (error) {
            console.error("❌ Backend Error:", error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    });
});

// 📱 2. Get All Videos (Home Feed)
router.get("/all", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                profiles (username, avatar_url)
            `) // User details bhi saath mein aayengi
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 👤 3. Get User Specific Videos (For Profile Screen)
router.get("/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;