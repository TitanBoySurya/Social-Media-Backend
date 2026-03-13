const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
try {

    // Authorization header se token lena
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(403).json({
            success: false,
            message: "Access Denied: No Token Provided"
        });
    }

    const secret = process.env.JWT_SECRET || "YashoraSecretKey";

    jwt.verify(token, secret, (err, decoded) => {

        if (err) {
            return res.status(401).json({
                success: false,
                message: "Invalid or Expired Token"
            });
        }

        // Token se user data request me daalna
        req.user = decoded;

        next();
    });

} catch (error) {
    console.error("🔥 Middleware Error:", error.message);

    res.status(500).json({
        success: false,
        message: "Internal Server Error in Auth"
    });
}

};

module.exports = verifyToken;