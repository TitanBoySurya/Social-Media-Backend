const express = require("express")
const router = express.Router()

const supabase = require("../config/supabaseClient")
const verifyToken = require("../middleware/authMiddleware")


// =================================
// 1️⃣ VIDEO UPLOAD
// =================================
router.post("/upload", verifyToken, async (req, res) => {

 const upload = req.app.get("upload").single("video")

 upload(req, res, async (err) => {

  if (err) {

   console.error("🔥 Multer Error:", err)

   return res.status(500).json({
    success:false,
    message:"File upload error"
   })

  }

  const file = req.file

  if (!file) {

   return res.status(400).json({
    success:false,
    message:"No video file provided"
   })

  }

  try{

   const userId = req.user.id
   const userEmail = req.user.email
   const userName =
   req.user.user_metadata?.full_name ||
   "Yashora User"

   // ==========================
   // CHECK PROFILE
   // ==========================
   const { data:profile } =
   await supabase
   .from("profiles")
   .select("id")
   .eq("id",userId)
   .maybeSingle()

   if(!profile){

    const { error:profileError } =
    await supabase
    .from("profiles")
    .insert([
     {
      id:userId,
      email:userEmail,
      username:userName
     }
    ])

    if(profileError) throw profileError

   }

   // ==========================
   // UPLOAD VIDEO
   // ==========================
   const fileName =
   `yashora_${userId}_${Date.now()}.mp4`

   const { error:storageError } =
   await supabase.storage
   .from("yashora-videos")
   .upload(fileName,file.buffer,{
    contentType:"video/mp4",
    upsert:false
   })

   if(storageError) throw storageError

   // ==========================
   // GET PUBLIC URL
   // ==========================
   const { data:urlData } =
   supabase.storage
   .from("yashora-videos")
   .getPublicUrl(fileName)

   const videoUrl = urlData.publicUrl

   // ==========================
   // SAVE POST
   // ==========================
   const { error:dbError } =
   await supabase
   .from("posts")
   .insert([
    {
     user_id:userId,
     video_url:videoUrl,
     description:
     req.body.description ||
     "Yashora Reel",
     created_at:new Date()
    }
   ])

   if(dbError) throw dbError

   res.status(200).json({
    success:true,
    message:"Video uploaded successfully",
    video_url:videoUrl
   })

  }catch(error){

   console.error(
   "❌ Backend Error:",
   error.message
   )

   res.status(500).json({
    success:false,
    message:error.message
   })

  }

 })

})


// =================================
// 2️⃣ HOME FEED (PAGINATION)
// =================================
router.get("/all", async (req,res)=>{

 try{

  const page =
  parseInt(req.query.page) || 1

  const limit = 10

  const from =
  (page - 1) * limit

  const to =
  from + limit - 1

  const { data,error } =
  await supabase
  .from("posts")
  .select(`
   *,
   profiles (
    username,
    avatar_url
   )
  `)
  .order("created_at",
  { ascending:false })
  .range(from,to)

  if(error) throw error

  res.status(200).json({
   success:true,
   page,
   data
  })

 }catch(error){

  console.error(
  "❌ Feed Error:",
  error.message
  )

  res.status(500).json({
   success:false,
   message:error.message
  })

 }

})


// =================================
// 3️⃣ USER PROFILE VIDEOS
// =================================
router.get("/user/:userId",
async (req,res)=>{

 try{

  const { userId } =
  req.params

  const { data,error } =
  await supabase
  .from("posts")
  .select("*")
  .eq("user_id",userId)
  .order("created_at",
  { ascending:false })

  if(error) throw error

  res.status(200).json({
   success:true,
   data
  })

 }catch(error){

  console.error(
  "❌ Profile Videos Error:",
  error.message
  )

  res.status(500).json({
   success:false,
   message:error.message
  })

 }

})


// =================================
// 4️⃣ DELETE POST
// =================================
router.delete("/:id",
verifyToken,
async(req,res)=>{

 try{

  const postId =
  req.params.id

  const userId =
  req.user.id

  const { data:post,error } =
  await supabase
  .from("posts")
  .select("video_url")
  .eq("id",postId)
  .single()

  if(error) throw error

  const fileName =
  post.video_url.split("/")
  .pop()

  await supabase.storage
  .from("yashora-videos")
  .remove([fileName])

  await supabase
  .from("posts")
  .delete()
  .eq("id",postId)
  .eq("user_id",userId)

  res.json({
   success:true,
   message:"Post deleted"
  })

 }catch(error){

  res.status(500).json({
   success:false,
   message:error.message
  })

 }

})


module.exports = router