require("dotenv").config();
require("./config/supabaseClient");


const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const morgan = require("morgan");
const multer = require("multer");

const analyticsRoutes = require("./routes/analyticsRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();
const server = http.createServer(app);

// ===============================
// 🔥 MULTER CONFIG (Video Upload)
// ===============================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 🔥 reduce to 50MB (safer)
  }
});
app.set("upload", upload);

// ===============================
// 🔥 SOCKET.IO SETUP
// ===============================
const io = new Server(server, {
  cors: {
    origin: "*", // 👉 production me domain dalna
    methods: ["GET", "POST"]
  }
});

// ===============================
// 🔥 MIDDLEWARE
// ===============================
app.use(cors({
  origin: "*", // 👉 production me restrict karo
  credentials: true
}));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({
  extended: true,
  limit: "20mb"
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
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/posts", require("./routes/postRoutes"));
app.use("/api/follow", require("./routes/followRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/monetization", require("./routes/monetizationRoutes"));
app.use("/api/system", require("./routes/systemDebugRoutes"));
app.use("/api/analytics", analyticsRoutes);
app.use("/api/payments", paymentRoutes);

// ===============================
// ❌ 404 HANDLER (IMPORTANT)
// ===============================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

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