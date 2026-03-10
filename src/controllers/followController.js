const db = require("../config/supabaseClient");
const { createNotification } = require("./notificationController");

exports.toggleFollow = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;

    if (followerId == followingId) return res.status(400).json({ message: "Cannot follow yourself" });

    const [existing] = await db.query("SELECT * FROM followers WHERE follower_id = ? AND following_id = ?", [followerId, followingId]);

    if (existing.length > 0) {
      await db.query("DELETE FROM followers WHERE follower_id = ? AND following_id = ?", [followerId, followingId]);
      return res.json({ success: true, isFollowing: false });
    } else {
      await db.query("INSERT INTO followers (follower_id, following_id) VALUES (?, ?)", [followerId, followingId]);
      
      // 🔔 Notification bhejein
      await createNotification(req, parseInt(followingId), 'follow');
      
      return res.json({ success: true, isFollowing: true });
    }
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
};