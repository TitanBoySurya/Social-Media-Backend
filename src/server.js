require("dotenv").config()
require("./config/supabaseClient")

const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const morgan = require("morgan")
const multer = require("multer")

const app = express()
const server = http.createServer(app)

// ===============================
// MULTER CONFIG
// ===============================
const upload = multer({
 storage: multer.memoryStorage(),
 limits:{
  fileSize:100 * 1024 * 1024 //100MB
 }
})

app.set("upload",upload)

// ===============================
// SOCKET.IO
// ===============================
const io = new Server(server,{
 cors:{
  origin:"*",
  methods:["GET","POST"]
 }
})

// ===============================
// MIDDLEWARE
// ===============================
app.use(cors())

app.use(express.json({ limit:"50mb" }))
app.use(express.urlencoded({
 extended:true,
 limit:"50mb"
}))

app.use(morgan("dev"))

// ===============================
// BASIC ROUTES
// ===============================
app.get("/",(req,res)=>{
 res.send("Suryoday API is Flying 🚀")
})

app.get("/health",(req,res)=>{
 res.status(200).json({
  status:"OK",
  time:new Date()
 })
})

// ===============================
// SOCKET USERS
// ===============================
let onlineUsers=[]

io.on("connection",(socket)=>{

 console.log("New Connection:",socket.id)

 socket.on("addNewUser",(userId)=>{

  if(
   userId &&
   !onlineUsers.some(
    user=>user.userId===userId
   )
  ){

   onlineUsers.push({
    userId,
    socketId:socket.id
   })

  }

  io.emit("getOnlineUsers",onlineUsers)

 })

 socket.on("disconnect",()=>{

  console.log("User disconnected:",socket.id)

  onlineUsers =
  onlineUsers.filter(
   user=>user.socketId!==socket.id
  )

  io.emit("getOnlineUsers",onlineUsers)

 })

})

// ===============================
// IO ACCESS IN ROUTES
// ===============================
app.use((req,res,next)=>{
 req.io = io
 next()
})

// ===============================
// API ROUTES
// ===============================
app.use("/api/auth",require("./routes/authRoutes"))
app.use("/api/users",require("./routes/userRoutes"))
app.use("/api/posts",require("./routes/postRoutes"))
app.use("/api/follow",require("./routes/followRoutes"))
app.use("/api/chat",require("./routes/chatRoutes"))
app.use("/api/notifications",require("./routes/notificationRoutes"))
app.use("/api/monetization",require("./routes/monetizationRoutes"))

// ===============================
// GLOBAL ERROR HANDLER
// ===============================
app.use((err,req,res,next)=>{

 console.error("🔥 Server Error:",err.stack)

 res.status(500).json({
  success:false,
  message:"Something went wrong"
 })

})

// ===============================
// SERVER START
// ===============================
const PORT =
process.env.PORT || 5000

server.listen(PORT,()=>{

 console.log(
 `🚀 SURYODAY BACKEND RUNNING ON PORT ${PORT}`
 )

})