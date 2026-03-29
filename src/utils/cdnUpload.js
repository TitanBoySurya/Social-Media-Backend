const fs = require("fs");
const path = require("path");
const axios = require("axios");

// ================= 🔥 CONFIG =================

// 👉 CHANGE THIS
const STORAGE_ZONE = "yashora-videos";

// 👉 👇 APNI KEY YAHA PASTE KARO
const ACCESS_KEY = "947c8b39-9a93-4a15-ad6334469793-c8f8-45f5";

// 👉 REGION CHECK KARO (IMPORTANT)
const REGION = "storage.bunnycdn.com"; 
// Singapore ho toh: "sg.storage.bunnycdn.com"

// ================= CONTENT TYPE =================
const getContentType = (filePath) => {
  if (filePath.endsWith(".m3u8")) {
    return "application/vnd.apple.mpegurl";
  }
  if (filePath.endsWith(".ts")) {
    return "video/mp2t";
  }
  return "application/octet-stream";
};

// ================= UPLOAD FILE =================
const uploadFile = async (localPath, remotePath, retry = 2) => {
  try {
    const fileStream = fs.createReadStream(localPath);

    const url = `https://${REGION}/${STORAGE_ZONE}/${remotePath}`;

    await axios.put(url, fileStream, {
      headers: {
        AccessKey: ACCESS_KEY,
        "Content-Type": getContentType(localPath)
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log("✅ Uploaded:", remotePath);

  } catch (err) {
    console.error("❌ Upload Failed:", remotePath);

    if (retry > 0) {
      console.log("🔁 Retrying...");
      await uploadFile(localPath, remotePath, retry - 1);
    } else {
      throw err;
    }
  }
};

// ================= UPLOAD FOLDER =================
const uploadFolder = async (folderPath, basePath) => {
  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const fullPath = path.join(folderPath, file);

    if (fs.lstatSync(fullPath).isDirectory()) {
      await uploadFolder(fullPath, `${basePath}/${file}`);
    } else {
      const remotePath = `${basePath}/${file}`;

      console.log("⬆️ Uploading:", remotePath);

      await uploadFile(fullPath, remotePath);
    }
  }
};

// ================= DELETE LOCAL =================
const deleteLocalFolder = (folderPath) => {
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
    console.log("🧹 Local HLS deleted:", folderPath);
  }
};

module.exports = {
  uploadFolder,
  deleteLocalFolder
};