const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");

// Google Client
const client = new OAuth2Client(
  "470251409399-o3n17oeodo4vnncneqk1fv8ukvpmcrtr.apps.googleusercontent.com"
);

const JWT_SECRET = process.env.JWT_SECRET || "YashoraSecretKey";


// =================================
// GOOGLE LOGIN
// =================================
router.post("/google-login", async (req, res) => {

  console.log("🟡 Google Login Attempt...");

  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      success: false,
      message: "ID Token is required"
    });
  }

  try {

    const ticket = await client.verifyIdToken({
      idToken,
      audience:
        "470251409399-o3n17oeodo4vnncneqk1fv8ukvpmcrtr.apps.googleusercontent.com",
    });

    const payload = ticket.getPayload();

    const { email, name, picture, sub: googleId } = payload;

    console.log("📧 Verifying:", email);

    // Check if user exists
    const { data: existingUser, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;

    let user = existingUser;

    // Create user if not exists
    if (!user) {

      console.log("🆕 Creating new user");

      const { data: newUser, error: insertError } = await supabase
        .from("profiles")
        .insert([
          {
            email: email,
            username: name,
            avatar_url: picture,
            google_id: googleId
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      user = newUser;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      token,
      user
    });

  } catch (error) {

    console.error("❌ Google Auth Error:", error.message);

    res.status(401).json({
      success: false,
      message: error.message
    });
  }
});


// =================================
// EMAIL LOGIN
// =================================
router.post("/login", async (req, res) => {

  console.log("🔵 Email Login Attempt...");

  const { email, password } = req.body;

  try {

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const userId = data.user.id;

    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;

    const token = jwt.sign(
      { id: profile.id, email: profile.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      token,
      user: profile
    });

  } catch (error) {

    console.error("❌ Login Error:", error.message);

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});


// =================================
// REGISTER
// =================================
router.post("/register", async (req, res) => {

  console.log("🟢 Registration Attempt...");

  const { email, password, username } = req.body;

  try {

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) throw error;

    const userId = data.user.id;

    // create profile
    const { error: profileError } = await supabase
      .from("profiles")
      .insert([
        {
          id: userId,
          email: email,
          username: username
        }
      ]);

    if (profileError) throw profileError;

    res.status(201).json({
      success: true,
      message: "Registration successful"
    });

  } catch (error) {

    console.error("❌ Registration Error:", error.message);

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});


// =================================
// USER PROFILE
// =================================
router.get("/profile/:userId", async (req, res) => {

  try {

    const { userId } = req.params;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id,username,email,avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    const { count } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    res.status(200).json({
      ...profile,
      post_count: count || 0
    });

  } catch (error) {

    console.error("❌ Profile Error:", error.message);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// =================================
// USER SEARCH
// =================================
router.get("/search/:username", async (req, res) => {

  try {

    const { username } = req.params;

    const { data, error } = await supabase
      .from("profiles")
      .select("id,username,avatar_url")
      .ilike("username", `%${username}%`);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    console.error("❌ Search Error:", error.message);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


module.exports = router;