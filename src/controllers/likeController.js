const supabase = require('../config/supabaseClient');
const { createNotification } = require('./notificationController');

exports.toggleLike = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    // 1. Post details nikalna (Notification ke liye owner ID chahiye)
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    if (postErr || !post) return res.status(404).json({ success: false, message: "Post not found" });

    const postOwnerId = post.user_id;

    // 2. Check karna ki user ne pehle se like kiya hai ya nahi
    const { data: existingLike, error: likeErr } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .single();

    if (existingLike) {
      // UNLIKE Logic: Like remove karein aur count ghatayein
      await supabase.from('likes').delete().eq('user_id', userId).eq('post_id', postId);
      await supabase.rpc('decrement_likes', { post_id: postId });

      return res.json({ success: true, liked: false, message: "Post Unliked" });
    } else {
      // LIKE Logic: Like add karein aur count badhayein
      await supabase.from('likes').insert([{ user_id: userId, post_id: postId }]);
      await supabase.rpc('increment_likes', { post_id: postId });

      // 🔔 Notification bhejein (Sirf tab jab koi aur like kare)
      if (userId !== postOwnerId) {
        await createNotification(req, postOwnerId, 'like', postId);
      }

      return res.json({ success: true, liked: true, message: "Post Liked" });
    }
  } catch (err) {
    console.error("Like Error:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};