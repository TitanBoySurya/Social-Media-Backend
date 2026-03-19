const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  try {

    // 🔥 Authorization header check
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Token missing or malformed"
      });
    }

    const token = authHeader.split(" ")[1];

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("❌ JWT_SECRET missing in .env");
      return res.status(500).json({
        success: false,
        message: "Server configuration error"
      });
    }

    // 🔥 Verify token (SYNC version → better performance)
    const decoded = jwt.verify(token, secret);

    // 🔥 Important: only required fields attach karo
    req.user = {
      id: decoded.id,
      email: decoded.email
    };

    next();

  } catch (error) {

    console.error("🔥 AUTH ERROR:", error.message);

    // 🔥 Specific error handling
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired"
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication failed"
    });
  }
};

module.exports = verifyToken;