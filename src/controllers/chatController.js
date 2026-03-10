const db = require("../config/supabaseClient");

// 1. SEND MESSAGE
exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, message } = req.body;

    if (!message) return res.status(400).json({ message: "Message is empty" });

    // DB mein save karein
    const [result] = await db.query(
      "INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)",
      [senderId, receiverId, message]
    );

    // REAL-TIME: Socket.io se bhejien
    const io = req.app.get("socketio");
    const onlineUsers = req.app.get("onlineUsers");
    const receiver = onlineUsers.find(user => user.userId === parseInt(receiverId));

    if (receiver) {
      io.to(receiver.socketId).emit("getMessage", {
        id: result.insertId,
        senderId,
        message,
        createdAt: new Date()
      });
    }

    res.json({ success: true, message: "Message sent", messageId: result.insertId });
  } catch (err) {
    res.status(500).json({ message: "Chat error" });
  }
};

// 2. GET CHAT HISTORY (Ek specific user ke saath)
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const chatWithId = req.params.userId;

    const sql = `
      SELECT * FROM messages 
      WHERE (sender_id = ? AND receiver_id = ?) 
      OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
    `;
    const [rows] = await db.query(sql, [userId, chatWithId, chatWithId, userId]);
    res.json({ success: true, messages: rows });
  } catch (err) {
    res.status(500).json({ message: "Error fetching messages" });
  }
};