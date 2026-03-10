const supabase = require('../config/supabaseClient');

const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: "No token, authorization denied" });
    }

    // Supabase se token verify karein
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ success: false, message: "Token is not valid" });
    }

    // Request object mein user data daal dein
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error in Auth Middleware" });
  }
};

module.exports = verifyToken;