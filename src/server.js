require("dotenv").config(); // PostgreSQL connection
require("./config/supabaseClient"); // Supabase client
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const morgan = require("morgan");

const app = express();
const server = http.createServer(app);

// 🌐 1. Socket.io Setup (CORS fixed for production)
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Forms ke liye zaroori
app.use(morgan("dev"));

// ☁️ 2. Static Folders (Ab iski zarurat nahi, hum Supabase use kar rahe hain)
// Agar aapne koi static images frontend ke liye rakhi hain tabhi ise rakhein, warna hata dein.

// 🚀 3. Basic & Health Routes
app.get("/", (req, res) => res.send("Suryoday API is Flying on Cloud! 🚀"));
app.get("/health", (req, res) => res.status(200).json({ status: "OK", time: new Date() }));

// 🔌 4. Socket.io Real-time Logic (Notifications ke liye)
let onlineUsers = [];
io.on("connection", (socket) => {
  console.log(`New Connection: ${socket.id}`);

  socket.on("addNewUser", (userId) => {
    if (userId && !onlineUsers.some(user => user.userId === userId)) {
      onlineUsers.push({ userId, socketId: socket.id });
    }
    io.emit("getOnlineUsers", onlineUsers);
  });

  socket.on("disconnect", () => {
    onlineUsers = onlineUsers.filter(user => user.socketId !== socket.id);
    io.emit("getOnlineUsers", onlineUsers);
  });
});

// Pass io to all requests (Controllers mein access karne ke liye)
app.use((req, res, next) => {
  req.io = io;
  next();
});

// 📁 5. API Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/posts", require("./routes/postRoutes"));
app.use("/api/follow", require("./routes/followRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/monetization", require("./routes/monetizationRoutes"));

// 🛡️ 6. Global Error Handler (Zaroori hai!)
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.stack);
  res.status(500).json({ success: false, message: "Something went wrong on the server!" });
});

// 🚢 7. Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  ===========================================
  🚀 SURYODAY BACKEND IS LIVE!
  📡 Port: ${PORT}
  🌍 Environment: ${process.env.NODE_ENV || 'development'}
  ===========================================
  `);
});