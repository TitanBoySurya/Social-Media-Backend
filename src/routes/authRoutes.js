const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");

// Google Client Configuration
const client = new OAuth2Client("470251409399-o3n17oeodo4vnncneqk1fv8ukvpmcrtr.apps.googleusercontent.com");

/**
 * @description: Google Login Endpoint
 * Password-free authentication using Google ID Token
 */
router.post("/google-login", async (req, res) => {
    console.log("🟡 Google Login Attempt...");
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ success: false, message: "ID Token is required" });
    }

    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: "470251409399-o3n17oeodo4vnncneqk1fv8ukvpmcrtr.apps.googleusercontent.com",
        });

        const payload = ticket.getPayload();
        const { email, name, picture, sub: googleId } = payload;

        console.log(`📧 Verifying User: ${email}`);

        // Check if user exists in profiles table
        let { data: user, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single();

        // If user doesn't exist, create a new profile
        if (!user) {
            console.log("🆕 Creating new user profile for Google User");
            const { data: newUser, error: insertError } = await supabase
                .from('profiles')
                .insert([{ 
                    email: email, 
                    username: name, 
                    avatar_url: picture, 
                    google_id: googleId 
                }])
                .select()
                .single();

            if (insertError) throw insertError;
            user = newUser;
        }

        // Generate JWT Token for backend session
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || "YashoraSecretKey",
            { expiresIn: "7d" }
        );

        console.log("✅ Google Login Successful");
        return res.status(200).json({
            success: true,
            token: token,
            user: user
        });

    } catch (error) {
        console.error("❌ Google Auth Error:", error.message);
        return res.status(401).json({ success: false, message: "Authentication failed: " + error.message });
    }
});

/**
 * @description: Traditional Email/Password Login
 */
router.post("/login", async (req, res) => {
    console.log("🔵 Email Login Attempt...");
    const { email, password } = req.body;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Fetch profile data to link with session
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileError) throw profileError;

        const token = jwt.sign(
            { id: profile.id, email: profile.email },
            process.env.JWT_SECRET || "YashoraSecretKey",
            { expiresIn: "7d" }
        );

        return res.status(200).json({ success: true, token, user: profile });
    } catch (error) {
        console.error("❌ Login Error:", error.message);
        return res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * @description: Traditional User Registration
 */
router.post("/register", async (req, res) => {
    console.log("🟢 New User Registration...");
    const { email, password, username } = req.body;

    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (data.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{ id: data.user.id, email, username }]);

            if (profileError) throw profileError;
        }

        return res.status(201).json({ success: true, message: "Registration successful! Please login." });
    } catch (error) {
        console.error("❌ Registration Error:", error.message);
        return res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;