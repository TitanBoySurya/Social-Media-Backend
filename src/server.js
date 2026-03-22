require("dotenv").config();
require("./config/supabaseClient");

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const morgan = require("morgan");
const multer = require("multer");

const app = express();
const server = http.createServer(app);

// ===============================
// 🔥 MULTER CONFIG (Video Upload)
// ===============================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});
app.set("upload", upload);

// ===============================
// 🔥 SOCKET.IO SETUP
// ===============================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ===============================
// 🔥 MIDDLEWARE
// ===============================
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({
  extended: true,
  limit: "50mb"
}));
app.use(morgan("dev"));

// ===============================
// ✅ BASIC ROUTES
// ===============================
app.get("/", (req, res) => {
  res.send("🚀 Suryoday API Running");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    time: new Date()
  });
});

// ===============================
// 🔥 SOCKET USER TRACKING
// ===============================
let onlineUsers = [];

io.on("connection", (socket) => {

  console.log("🟢 Connected:", socket.id);

  socket.on("addNewUser", (userId) => {
    if (
      userId &&
      !onlineUsers.some(u => u.userId === userId)
    ) {
      onlineUsers.push({
        userId,
        socketId: socket.id
      });
    }

    io.emit("getOnlineUsers", onlineUsers);
  });

  // 🔥 REALTIME LIKE EVENT
  socket.on("likePost", ({ postId, userId }) => {
    socket.broadcast.emit("likeUpdated", {
      postId,
      userId
    });
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);

    onlineUsers = onlineUsers.filter(
      u => u.socketId !== socket.id
    );

    io.emit("getOnlineUsers", onlineUsers);
  });

});

// ===============================
// 🔥 PASS IO TO ROUTES
// ===============================
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ===============================
// 🚀 API ROUTES
// ===============================
// Auth routes (login, register, google login, profile, search)
app.use("/api/auth", require("./routes/authRoutes"));

// Post, follow, chat, notifications, monetization, system debug
app.use("/api/posts", require("./routes/postRoutes"));
app.use("/api/follow", require("./routes/followRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/monetization", require("./routes/monetizationRoutes"));
app.use("/api/system", require("./routes/systemDebugRoutes"));

// ===============================
// ❌ GLOBAL ERROR HANDLER
// ===============================
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err.stack);

  res.status(500).json({
    success: false,
    message: err.message || "Server Error"
  });
});

// ===============================
// 🚀 SERVER START
// ===============================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
});