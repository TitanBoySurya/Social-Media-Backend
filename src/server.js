require("dotenv").config(); 
require("./config/supabaseClient"); 
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const morgan = require("morgan");
const multer = require("multer"); // 👈 1. Multer add kiya

const app = express();
const server = http.createServer(app);

// 📁 2. Multer Configuration (Memory storage for Supabase)
const upload = multer({ storage: multer.memoryStorage() });
app.set("upload", upload); // 👈 3. Ise set kiya taaki routes use kar sakein

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(morgan("dev"));

app.get("/", (req, res) => res.send("Suryoday API is Flying on Cloud! 🚀"));
app.get("/health", (req, res) => res.status(200).json({ status: "OK", time: new Date() }));

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

app.use((req, res, next) => {
  req.io = io;
  next();
});

// 📁 4. API Routes (Aapke original routes)
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/posts", require("./routes/postRoutes")); // 👈 Video logic yahan jayega
app.use("/api/follow", require("./routes/followRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/monetization", require("./routes/monetizationRoutes"));

app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.stack);
  res.status(500).json({ success: false, message: "Something went wrong on the server!" });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 SURYODAY BACKEND IS LIVE ON PORT: ${PORT}`);
});