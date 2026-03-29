const supabase = require("../config/supabaseClient");

// ================= FOLLOW / UNFOLLOW =================
exports.toggleFollow = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.userId;

    if (followerId === followingId) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow yourself"
      });
    }

    const { data: existing } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle();

    let following;

    if (existing) {
      await supabase
        .from("follows")
        .delete()
        .eq("id", existing.id);

      following = false;
    } else {
      await supabase
        .from("follows")
        .insert([{
          follower_id: followerId,
          following_id: followingId
        }]);

      following = true;
    }

    res.json({
      success: true,
      following
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

// ================= GET USER PROFILE =================
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUser = req.user.id;

    const { data: user } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    const { data: posts } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const { count: followersCount } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId);

    const { count: followingCount } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId);

    const { data: isFollow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", currentUser)
      .eq("following_id", userId)
      .maybeSingle();

    res.json({
      success: true,
      data: {
        user,
        posts,
        followersCount,
        followingCount,
        isFollowing: !!isFollow
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};