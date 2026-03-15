const express = require("express");
const router = express.Router();
const supabase = require("../config/supabaseClient");


// =======================
// REGISTER
// =======================
router.post("/register", async (req, res) => {

    const { username, email, password } = req.body;

    console.log("🟢 Register Attempt:", email);

    try {

        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password
        });

        if (error) throw error;

        const userId = data.user.id;

        const { error: profileError } = await supabase
            .from("profiles")
            .insert([
                {
                    id: userId,
                    username: username,
                    email: email
                }
            ]);

        if (profileError) throw profileError;

        res.status(200).json({
            success: true,
            message: "User registered successfully"
        });

    } catch (err) {

        console.error("❌ Register Error:", err.message);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


// =======================
// LOGIN
// =======================
router.post("/login", async (req, res) => {

    const { email, password } = req.body;

    console.log("🔵 Login Attempt:", email);

    try {

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        const userId = data.user.id;

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

        if (profileError) throw profileError;

        res.status(200).json({
            success: true,
            user: profile,
            token: data.session.access_token
        });

    } catch (err) {

        console.error("❌ Login Error:", err.message);

        res.status(401).json({
            success: false,
            message: "Invalid Credentials"
        });
    }
});


// =======================
// 🔍 USER SEARCH
// =======================
router.get("/search/:username", async (req, res) => {

    try {

        const { username } = req.params;

        const { data, error } = await supabase
            .from("profiles")
            .select("id, username, email, avatar_url")
            .ilike("username", `%${username}%`);

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: data
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