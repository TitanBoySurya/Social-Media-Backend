const supabase = require("../config/supabaseClient")
const { compressVideo } = require("../utils/videoProcessor")
const path = require("path")
const fs = require("fs")

// ==============================
// 🎥 CREATE POST (UPLOAD + COMPRESS)
// ==============================
exports.createPost = async (req, res) => {

 let inputPath = null
 let outputPath = null

 try {

  const userId = req.user.id

  if (!req.file) {
   return res.status(400).json({
    success:false,
    message:"No video file provided"
   })
  }

  inputPath = req.file.path

  outputPath = path.join(
   "uploads",
   `compressed_${Date.now()}.mp4`
  )

  // 1️⃣ Compress Video
  await compressVideo(inputPath, outputPath)

  // 2️⃣ Read compressed file
  const fileBuffer = fs.readFileSync(outputPath)

  const fileName =
   `yashora_${userId}_${Date.now()}.mp4`

  // 3️⃣ Upload to Supabase Storage
  const { error: storageError } =
  await supabase.storage
   .from("yashora-videos")
   .upload(fileName, fileBuffer, {
    contentType:"video/mp4",
    upsert:false
   })

  if(storageError) throw storageError

  // 4️⃣ Get Public URL
  const { data:urlData } =
  supabase.storage
   .from("yashora-videos")
   .getPublicUrl(fileName)

  const videoUrl = urlData.publicUrl

  // 5️⃣ Save in Database
  const { data,error } =
  await supabase
   .from("posts")
   .insert({
    user_id:userId,
    video_url:videoUrl,
    description:req.body.description || "Yashora Reel"
   })
   .select()

  if(error) throw error

  // 6️⃣ Delete temp files
  if(fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
  if(fs.existsSync(outputPath)) fs.unlinkSync(outputPath)

  res.status(201).json({
   success:true,
   post:data[0]
  })

 } catch(err){

  console.error("Upload Error:",err)

  if(inputPath && fs.existsSync(inputPath))
   fs.unlinkSync(inputPath)

  if(outputPath && fs.existsSync(outputPath))
   fs.unlinkSync(outputPath)

  res.status(500).json({
   success:false,
   message:err.message
  })

 }

}


// ==============================
// 📱 GET ALL POSTS (HOME FEED)
// ==============================
exports.getAllPosts = async (req,res)=>{

 try{

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
   .order("created_at",{ ascending:false })

  if(error) throw error

  res.json({
   success:true,
   posts:data
  })

 }catch(err){

  res.status(500).json({
   success:false,
   message:err.message
  })

 }

}


// ==============================
// 👤 GET USER POSTS
// ==============================
exports.getUserPosts = async (req,res)=>{

 try{

  const userId = req.params.userId

  const { data,error } =
  await supabase
   .from("posts")
   .select("*")
   .eq("user_id",userId)
   .order("created_at",{ ascending:false })

  if(error) throw error

  res.json({
   success:true,
   posts:data
  })

 }catch(err){

  res.status(500).json({
   success:false,
   message:err.message
  })

 }

}


// ==============================
// ❌ DELETE POST
// ==============================
exports.deletePost = async (req,res)=>{

 try{

  const postId = req.params.id
  const userId = req.user.id

  // 1️⃣ get video url
  const { data:post,error } =
  await supabase
   .from("posts")
   .select("video_url")
   .eq("id",postId)
   .single()

  if(error) throw error

  // 2️⃣ delete from storage
  if(post?.video_url){

   const fileName =
   post.video_url.split("/").pop()

   await supabase.storage
    .from("yashora-videos")
    .remove([fileName])

  }

  // 3️⃣ delete database row
  await supabase
   .from("posts")
   .delete()
   .eq("id",postId)
   .eq("user_id",userId)

  res.json({
   success:true,
   message:"Post deleted"
  })

 }catch(err){

  res.status(500).json({
   success:false,
   message:err.message
  })

 }

}