const supabase = require('../config/supabaseClient');

// =========================
// 1. ADD COMMENT
// =========================
exports.addComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: "Comment content is required" });
    }

    // Supabase Insert
    const { data, error } = await supabase
      .from('comments')
      .insert([{ user_id: userId, post_id: postId, content: content.trim() }])
      .select(`
        id, content, created_at,
        profiles (username, avatar_url)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: data
    });
  } catch (err) {
    console.error("Add Comment Error:", err.message);
    res.status(500).json({ success: false, message: "Server error while adding comment" });
  }
};

// =========================
// 2. GET COMMENTS BY POST
// =========================
exports.getCommentsByPost = async (req, res) => {
  try {
    const postId = req.params.id;

    // Fetch comments with user profiles
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id, content, created_at,
        profiles (id, username, avatar_url)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      postId,
      totalComments: data.length,
      comments: data
    });
  } catch (err) {
    console.error("Get Comments Error:", err.message);
    res.status(500).json({ success: false, message: "Database error" });
  }
};