// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");

// ENV CONFIG
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// ===============================
// VALIDATION MIDDLEWARE
// ===============================
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ===============================
// TOKEN GENERATOR
// ===============================
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ===============================
// GOOGLE LOGIN
// ===============================
router.post(
  "/google-login",
  [body("idToken").notEmpty().withMessage("ID Token required")],
  validate,
  async (req, res) => {
    try {
      const { idToken } = req.body;

      const ticket = await client.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });

      const { email, name, picture, sub: googleId } =
        ticket.getPayload();

      // 🔍 Check existing user
      let { data: user, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) throw error;

      // 🆕 Create user if not exists
      if (!user) {
        const username =
          name?.replace(/\s+/g, "").toLowerCase() +
          Math.floor(1000 + Math.random() * 9000);

        const { data, error: insertError } = await supabase
          .from("profiles")
          .insert([
            {
              email,
              username,
              avatar_url: picture,
              google_id: googleId,
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;
        user = data;
      }

      const token = generateToken(user);

      res.status(200).json({
        success: true,
        message: "Google login successful",
        token,
        user,
      });
    } catch (err) {
      console.error("❌ Google Auth Error:", err.message);
      res.status(401).json({
        success: false,
        message: "Authentication failed",
      });
    }
  }
);

// ===============================
// EMAIL LOGIN
// ===============================
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("password").notEmpty().withMessage("Password required"),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) throw error;

      const { data: profile, error: pError } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle();

      if (pError || !profile) {
        throw new Error("Profile not found");
      }

      const token = generateToken(profile);

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: profile,
      });
    } catch (err) {
      console.error("❌ Login Error:", err.message);
      res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }
  }
);

// ===============================
// REGISTER
// ===============================
router.post(
  "/register",
  [
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
    body("username").notEmpty(),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password, username } = req.body;

      const { data, error } =
        await supabase.auth.signUp({
          email,
          password,
        });

      if (error) throw error;

      const userId = data.user.id;

      const { error: profileError } =
        await supabase.from("profiles").insert([
          {
            id: userId,
            email,
            username,
          },
        ]);

      if (profileError) throw profileError;

      res.status(201).json({
        success: true,
        message: "Registration successful",
      });
    } catch (err) {
      console.error("❌ Register Error:", err.message);
      res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  }
);

// ===============================
// USER PROFILE
// ===============================
router.get("/profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: profile, error } =
      await supabase
        .from("profiles")
        .select("id, username, email, avatar_url, created_at")
        .eq("id", userId)
        .maybeSingle();

    if (error || !profile) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { count } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    res.json({
      success: true,
      data: {
        ...profile,
        stats: {
          posts: count || 0,
        },
      },
    });
  } catch (err) {
    console.error("❌ Profile Error:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ===============================
// USER SEARCH
// ===============================
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${q}%`)
      .limit(20);

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Search Error:", err.message);
    res.status(500).json({
      success: false,
      message: "Search failed",
    });
  }
});

module.exports = router;