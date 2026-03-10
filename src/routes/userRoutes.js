const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../config/supabaseClient");

// 1. REGISTER (Async/Await + Error Catching)
router.post("/register", async (req, res) => {
    const { username, email, password } = req.body;
    console.log("--- Register Attempt ---", email);

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // mysql2/promise ke liye .query().then().catch() ya await zaroori hai
        const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
        
        db.query(sql, [username, email, hashedPassword])
            .then(([result]) => {
                console.log("✅ User Created!");
                res.status(200).json({ success: true, message: "Success" });
            })
            .catch((err) => {
                // 🛡️ Ye block error ko pakad lega aur crash nahi hone dega
                if (err.code === 'ER_DUP_ENTRY') {
                    console.log("⚠️ Duplicate Email blocked. Server is still flying! 🚀");
                    return res.status(400).json({ success: false, message: "Email already exists" });
                }
                console.error("❌ SQL Error:", err.message);
                res.status(500).json({ success: false, error: err.message });
            });

    } catch (e) {
        console.error("❌ Server Error:", e.message);
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

// 2. LOGIN (Promise Based)
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    console.log("--- Login Attempt ---", email);

    try {
        const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

        if (users.length > 0) {
            const user = users[0];
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                console.log("✅ Login OK");
                return res.status(200).json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
            }
        }
        res.status(401).json({ success: false, message: "Invalid Credentials" });
    } catch (e) {
        console.error("❌ Login Error:", e.message);
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

module.exports = router;