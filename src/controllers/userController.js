const supabase = require('../config/supabaseClient');

// 1. UNIVERSAL SEARCH (Users & Posts)
exports.searchAll = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: "Search term required" });

    // Users search (username ke liye)
    const { data: users } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${q}%`)
      .limit(5);

    // Posts search (content ke liye)
    const { data: posts } = await supabase
      .from('posts')
      .select('id, content, profiles(username)')
      .ilike('content', `%${q}%`)
      .limit(10);

    res.json({ success: true, results: { users, posts } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Search failed" });
  }
};

// 2. UPDATE PROFILE (Bio, Name, Avatar)
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, bio, avatarUrl } = req.body;
    
    // Note: Agar multer use kar rahe hain toh path req.file.path se aayega
    const finalAvatarUrl = req.file ? req.file.path : avatarUrl;

    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        username: username?.trim(), 
        bio: bio?.trim(), 
        avatar_url: finalAvatarUrl,
        updated_at: new Date()
      })
      .eq('id', userId)
      .select();

    if (error) throw error;
    res.json({ success: true, message: "Profile updated!", data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Update failed" });
  }
};

// 3. GET USER PROFILE (With Stats & Posts)
exports.getUserProfile = async (req, res) => {
  try {
    const profileId = req.params.id;
    const loggedInId = req.user.id;

    // Supabase ek hi request mein stats fetch kar sakta hai
    const { data: user, error } = await supabase
      .from('profiles')
      .select(`
        *,
        posts(id, content, created_at)
      `)
      .eq('id', profileId)
      .order('created_at', { foreignTable: 'posts', ascending: false })
      .single();

    if (error || !user) return res.status(404).json({ message: "User not found" });

    // Check if logged-in user follows this profile
    const { data: isFollowing } = await supabase
      .from('followers')
      .select('id')
      .eq('follower_id', loggedInId)
      .eq('following_id', profileId)
      .single();

    res.json({
      success: true,
      user: user,
      isFollowing: !!isFollowing
    });
  } catch (err) {
    res.status(500).json({ message: "Profile error" });
  }
};

// 4. FOLLOWERS LIST
exports.getFollowers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('followers')
      .select('profiles!follower_id(id, username, avatar_url)')
      .eq('following_id', req.params.id);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ message: "Error" }); }
};

// 5. FOLLOWING LIST
exports.getFollowing = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('followers')
      .select('profiles!following_id(id, username, avatar_url)')
      .eq('follower_id', req.params.id);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ message: "Error" }); }
};