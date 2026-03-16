function detectEmbedPlatform(url){

 try{

  const parsed = new URL(url)
  const host = parsed.hostname.toLowerCase()

  if(host.includes("youtube") || host.includes("youtu.be")){
   return { valid:true, platform:"youtube" }
  }

  if(host.includes("instagram")){
   return { valid:true, platform:"instagram" }
  }

  if(host.includes("twitter") || host.includes("x.com")){
   return { valid:true, platform:"twitter" }
  }

  return {
   valid:false,
   message:"Unsupported platform"
  }

 }catch{

  return {
   valid:false,
   message:"Invalid URL"
  }

 }

}

module.exports = detectEmbedPlatform