const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// 🟢 YE RAHI WO LINE: Ise yahan daalna hai
const supabase = createClient(supabaseUrl, supabaseKey);

// Check karne ke liye ki connect hua ya nahi
if (supabase) {
    console.log("✅ Supabase Client Initialized Successfully!");
}

module.exports = supabase;