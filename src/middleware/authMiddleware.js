const jwt = require("jsonwebtoken");
const supabase = require("../config/supabaseClient");

const verifyToken = async (req, res, next) => {
    // 1. Header se token nikaalein (Format: Bearer <token>)
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(403).json({ success: false, message: "Access Denied: No Token Provided" });
    }

    try {
        // 2. Token ko verify karein (JWT Secret wahi hona chahiye jo authRoutes mein hai)
        const secret = process.env.JWT_SECRET || "YashoraSecretKey";
        
        jwt.verify(token, secret, (err, decoded) => {
            if (err) {
                return res.status(401).json({ success: false, message: "Invalid or Expired Token" });
            }

            // 3. User ki information request object mein daal dein
            // Taaki hum 'req.user.id' use kar sakein video upload ke waqt
            req.user = decoded; 
            next(); // Agle step (Controller/Route) par bhejein
        });

    } catch (error) {
        console.error("🔥 Middleware Error:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error in Auth" });
    }
};

module.exports = verifyToken;