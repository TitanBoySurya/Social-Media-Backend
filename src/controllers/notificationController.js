const db = require("../config/supabaseClient");

exports.createNotification = async (req, receiverId, type, postId = null) => {
  try {
    const senderId = req.user.id;
    if (senderId === receiverId) return; // Khud ke action par notification nahi

    // 1. DB mein save karein
    const sql = "INSERT INTO notifications (receiver_id, sender_id, type, post_id) VALUES (?, ?, ?, ?)";
    await db.query(sql, [receiverId, senderId, type, postId]);

    // 2. Real-time bhejien (Socket.io)
    const io = req.app.get("socketio");
    const onlineUsers = req.app.get("onlineUsers");
    const receiver = onlineUsers.find(user => user.userId === receiverId);

    if (receiver) {
      io.to(receiver.socketId).emit("getNotification", {
        senderId,
        type,
        postId
      });
    }
  } catch (err) {
    console.error("Notification Error:", err);
  }
};

// User ke notifications fetch karne ke liye
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = `
      SELECT n.*, u.username, u.profile_pic 
      FROM notifications n 
      JOIN users u ON n.sender_id = u.id 
      WHERE n.receiver_id = ? 
      ORDER BY n.created_at DESC LIMIT 20
    `;
    const [rows] = await db.query(sql, [userId]);
    res.json({ success: true, notifications: rows });
  } catch (err) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
};