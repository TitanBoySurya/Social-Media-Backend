const ffmpeg = require("fluent-ffmpeg")
const ffmpegPath = require("ffmpeg-static")
const fs = require("fs")

// FFmpeg path set
ffmpeg.setFfmpegPath(ffmpegPath)

// ==============================
// 🎥 VIDEO COMPRESSION FUNCTION
// ==============================
exports.compressVideo = (inputPath, outputPath) => {

 return new Promise((resolve, reject) => {

  if (!fs.existsSync(inputPath)) {
   return reject(
    new Error("Input video file not found")
   )
  }

  ffmpeg(inputPath)

   // Video codec
   .videoCodec("libx264")

   // Audio codec
   .audioCodec("aac")

   // Compression settings
   .outputOptions([
    "-crf 28",          // compression level
    "-preset fast",     // encoding speed
    "-movflags +faststart", // fast streaming
    "-vf scale=720:-2"  // resize to 720p
   ])

   // Output file
   .save(outputPath)

   // Compression start
   .on("start", (cmd) => {
    console.log("FFmpeg Started:", cmd)
   })

   // Compression progress
   .on("progress", (progress) => {
    if (progress.percent) {
     console.log(
      "Processing:",
      progress.percent.toFixed(2) + "%"
     )
    }
   })

   // Compression success
   .on("end", () => {
    console.log("Video compression finished")
    resolve(outputPath)
   })

   // Compression error
   .on("error", (err) => {
    console.error("FFmpeg Error:", err)
    reject(err)
   })

 })

}