const supabase = require('../config/supabaseClient');

// =========================
// 1. REGISTER (Supabase Auth)
// =========================
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // Supabase Auth call: Ye automatic hashing aur validation karta hai
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.trim(),
          full_name: username.trim(), // Starting mein full name username hi rakh sakte hain
        },
      },
    });

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: "Registration successful! Please check your email for verification.",
      userId: data.user?.id,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// =========================
// 2. LOGIN (Supabase Auth)
// =========================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    // Supabase login call
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    res.json({
      success: true,
      message: "Login successful",
      token: data.session.access_token, // JWT automatic mil jata hai
      user: {
        id: data.user.id,
        email: data.user.email,
        username: data.user.user_metadata.username,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error.message);
    res.status(401).json({ success: false, message: "Invalid email or password" });
  }
};

// =========================
// 3. GET PROFILE (From Profiles Table)
// =========================
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user?.id; // Ye verifyToken middleware se aayega

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized access" });
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, bio, wallet_balance, is_monetized, followers_count, total_views')
      .eq('id', userId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      user: data,
    });
  } catch (error) {
    console.error("PROFILE ERROR:", error.message);
    res.status(500).json({ success: false, message: "Database error" });
  }
};