// server/src/models/User.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const userSchema = new mongoose.Schema(
    {
        user_id: { type: String, unique: true, default: uuidv4 },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        username: { type: String, required: true, trim: true },
        password: { type: String, required: true },
        avatar: { type: String, default: "" },
        avatars: { type: [String], default: [] },
        createdAt: { type: Date, default: Date.now },

        preferences: {
            darkMode: { type: Boolean, default: false },
        },

        stats: {
            posts: { type: Number, default: 0 },
            likes: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
