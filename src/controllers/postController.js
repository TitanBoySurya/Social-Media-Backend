const supabase = require('../config/supabaseClient');

// 1. CREATE POST (Cloud Upload)
exports.createPost = async (req, res) => {
    try {
        const userId = req.user.id;
        const { content } = req.body;
        let mediaUrl = null;
        let mediaType = 'text';

        if (req.file) {
            const file = req.file;
            const fileName = `${userId}/${Date.now()}-${file.originalname}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(`posts/${fileName}`, file.buffer, { contentType: file.mimetype });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(`posts/${fileName}`);
            mediaUrl = publicUrlData.publicUrl;
            mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';
        }

        const { data, error } = await supabase
            .from('posts')
            .insert([{ user_id: userId, content, media_url: mediaUrl, media_type: mediaType }])
            .select();

        if (error) throw error;
        res.status(201).json({ success: true, post: data[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 2. GET ALL POSTS (Iska naam 'getAllPosts' hi hona chahiye)
exports.getAllPosts = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*, profiles:user_id(username, avatar_url)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, posts: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 3. GET FOLLOWING POSTS
exports.getFollowingPosts = async (req, res) => {
    try {
        const userId = req.user.id;
        const { data: following } = await supabase.from('followers').select('following_id').eq('follower_id', userId);
        const ids = following.map(f => f.following_id);
        ids.push(userId);

        const { data, error } = await supabase
            .from('posts')
            .select('*, profiles:user_id(username, avatar_url)')
            .in('user_id', ids)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, posts: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 4. DELETE POST
exports.deletePost = async (req, res) => {
    try {
        const { data, error } = await supabase.from('posts').delete().eq('id', req.params.id).eq('user_id', req.user.id);
        if (error) throw error;
        res.json({ success: true, message: "Post deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};