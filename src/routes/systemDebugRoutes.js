const express = require("express")
const router = express.Router()

const supabase = require("../config/supabaseClient")

// =====================================
// SYSTEM HEALTH DEBUG
// =====================================
router.get("/health", async (req,res)=>{

 try{

  // 1️⃣ Supabase DB check
  const { data:profiles } =
  await supabase
  .from("profiles")
  .select("*")
  .limit(3)

  // 2️⃣ Posts check
  const { data:posts } =
  await supabase
  .from("posts")
  .select("*")
  .limit(3)

  // 3️⃣ Feed query check
  const { data:feed } =
  await supabase
  .from("posts")
  .select(`
   *,
   profiles (
    username,
    avatar_url
   )
  `)
  .order("created_at",{ascending:false})
  .limit(5)

  // 4️⃣ Storage check
  const { data:files } =
  await supabase.storage
  .from("yashora-videos")
  .list("",{limit:5})

  res.json({

   backend:"OK",

   database:{
    profiles_count:profiles?.length || 0,
    posts_count:posts?.length || 0
   },

   feed_preview:feed,

   storage:{
    files:files?.length || 0
   }

  })

 }catch(error){

  res.status(500).json({
   success:false,
   message:error.message
  })

 }

})

module.exports = router