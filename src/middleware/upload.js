const multer = require("multer");

// Memory storage: Files ko server par save nahi karega, seedha RAM mein rakhega cloud upload ke liye
const storage = multer.memoryStorage();

// Filter: Sirf Images aur Videos (.mp4, .mov) allow honge
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/x-msvideo"];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type! Sirf images aur videos (MP4) allowed hain."), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB Max limit (Videos ke liye badha diya hai)
  fileFilter: fileFilter
});

module.exports = upload;