const supabase = require("../config/supabaseClient");

// 🎥 CREATE POST (Video Upload)
exports.createPost = async (req, res) => {
try {
const userId = req.user.id;

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "No video file provided"
        });
    }

    const file = req.file;
    const fileName = `yashora_${userId}_${Date.now()}.mp4`;

    // 1️⃣ Upload video to Supabase Storage
    const { error: storageError } = await supabase.storage
        .from("yashora-videos")
        .upload(fileName, file.buffer, {
            contentType: "video/mp4",
            upsert: false
        });

    if (storageError) throw storageError;

    // 2️⃣ Get Public URL
    const { data: urlData } = supabase.storage
        .from("yashora-videos")
        .getPublicUrl(fileName);

    const videoUrl = urlData.publicUrl;

    // 3️⃣ Insert into database
    const { data, error } = await supabase
        .from("posts")
        .insert([
            {
                user_id: userId,
                video_url: videoUrl,
                description: req.body.description || "Yashora Reel",
                created_at: new Date()
            }
        ])
        .select();

    if (error) throw error;

    res.status(201).json({
        success: true,
        post: data[0]
    });

} catch (err) {
    console.error("Upload Error:", err.message);

    res.status(500).json({
        success: false,
        message: err.message
    });
}

};

// 📱 GET ALL POSTS (Home Feed)
exports.getAllPosts = async (req, res) => {
try {
const { data, error } = await supabase
.from("posts")
.select("*, profiles ( username, avatar_url )")
.order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
        success: true,
        posts: data
    });

} catch (err) {
    res.status(500).json({
        success: false,
        message: err.message
    });
}

};

// 👤 GET USER POSTS
exports.getUserPosts = async (req, res) => {
try {
const userId = req.params.userId;

    const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
        success: true,
        posts: data
    });

} catch (err) {
    res.status(500).json({
        success: false,
        message: err.message
    });
}

};

// ❌ DELETE POST
exports.deletePost = async (req, res) => {
try {
const postId = req.params.id;
const userId = req.user.id;

    const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("user_id", userId);

    if (error) throw error;

    res.json({
        success: true,
        message: "Post deleted"
    });

} catch (err) {
    res.status(500).json({
        success: false,
        message: err.message
    });
}

};