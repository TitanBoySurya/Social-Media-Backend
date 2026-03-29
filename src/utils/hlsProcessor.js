const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

exports.convertToHLS = (inputPath, outputDir) => {
  return new Promise((resolve, reject) => {

    // ✅ Ensure folders exist
    fs.mkdirSync(`${outputDir}/v0`, { recursive: true });
    fs.mkdirSync(`${outputDir}/v1`, { recursive: true });
    fs.mkdirSync(`${outputDir}/v2`, { recursive: true });

    // ✅ Fix path (important for Windows)
    const safeInput = `"${inputPath}"`;

    const command = `
    ffmpeg -i ${safeInput} \
    -preset veryfast \
    -g 48 -sc_threshold 0 \
    -map 0:v -map 0:a? \
    -c:v libx264 -c:a aac -ar 48000 -b:a 128k \
    -s:v:0 1280x720 -b:v:0 1500k \
    -s:v:1 854x480 -b:v:1 800k \
    -s:v:2 426x240 -b:v:2 400k \
    -var_stream_map "v:0,a:0 v:1,a:0 v:2,a:0" \
    -master_pl_name master.m3u8 \
    -f hls \
    -hls_time 4 \
    -hls_playlist_type vod \
    -hls_segment_filename "${outputDir}/v%v/segment_%03d.ts" \
    "${outputDir}/v%v/index.m3u8"
    `;

    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error("❌ FFMPEG ERROR:", stderr);
        return reject(err);
      }

      console.log("✅ HLS CREATED");
      resolve({
        master: path.join(outputDir, "master.m3u8")
      });
    });

  });
};