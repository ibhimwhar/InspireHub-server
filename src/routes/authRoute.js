const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const multer = require("multer");
const User = require("../models/User.js");
const Post = require("../models/Post.js");
const authMiddleware = require("../middleware/authMiddleware.js");

const router = express.Router();

/* ---------- Multer Setup for Avatar Uploads ---------- */
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "..", "uploads")),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || "");
        cb(null, `avatar_${req.user?._id || "anon"}_${Date.now()}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB max
    fileFilter: (req, file, cb) => {
        const allowed = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
        if (!allowed.includes(file.mimetype)) return cb(new Error("Only images are allowed"));
        cb(null, true);
    },
});

/* ------------------- Auth Routes --------------------- */
// Strong password regex
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

// Signup
router.post("/signup", async (req, res) => {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    if (!strongPasswordRegex.test(password)) {
        return res.status(400).json({
            message: "Password must be at least 12 characters and include uppercase, lowercase, number, and symbol"
        });
    }

    try {
        const exists = await User.findOne({ email });
        if (exists) return res.status(409).json({ message: "User already exists" });

        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({
            email: email.toLowerCase(),
            username,
            password: hashed,
        });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.status(201).json({ token, userId: user._id });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// Login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({ token, userId: user._id });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Server error" });
    }
});


// Verify token
router.get("/verify", (req, res) => {
    try {
        const auth = req.headers.authorization;
        if (!auth) return res.status(401).json({ message: "No token provided" });

        const token = auth.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.json({ valid: true, user: decoded });
    } catch {
        res.status(401).json({ valid: false, message: "Invalid or expired token" });
    }
});

// Get current user
router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });

        // Count stats
        const posts = await Post.countDocuments({ author: req.user._id });
        // const likes = await Like.countDocuments({ user: req.user._id });
        const likes = 0; // placeholder until Like model is ready

        res.json({
            ...user.toObject(),
            stats: { posts, likes },
        });
    } catch (err) {
        console.error("Profile fetch error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// Update profile (username/email)
router.put("/update", authMiddleware, async (req, res) => {
    try {
        const { username, email } = req.body;
        if (!username && !email) return res.status(400).json({ message: "Nothing to update" });

        const toUpdate = {};
        if (username) toUpdate.username = username;
        if (email) toUpdate.email = email;

        const updated = await User.findByIdAndUpdate(req.user._id, toUpdate, {
            new: true,
            runValidators: true,
            select: "-password",
        });

        res.json(updated);
    } catch (err) {
        console.error("Update error:", err.message);
        res.status(500).json({ message: "Failed to update profile" });
    }
});

// Update preferences
router.put("/preferences", authMiddleware, async (req, res) => {
    try {
        const updated = await User.findByIdAndUpdate(
            req.user._id,
            { preferences: req.body },
            { new: true, select: "-password" }
        );
        res.json(updated);
    } catch (err) {
        console.error("Preferences error:", err.message);
        res.status(500).json({ message: "Failed to update preferences" });
    }
});

router.post("/avatar", authMiddleware, upload.single("avatar"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });

        const relativePath = `/uploads/${req.file.filename}`;

        // Push new avatar into the avatars array AND set it as active
        const updated = await User.findByIdAndUpdate(
            req.user._id,
            { $push: { avatars: relativePath }, avatar: relativePath },
            { new: true, select: "-password" }
        );

        res.json({
            message: "Avatar uploaded successfully",
            avatar: updated.avatar,
            avatars: updated.avatars, // return full array
        });
    } catch (err) {
        console.error("Avatar upload error:", err.message);
        res.status(500).json({ message: "Failed to upload avatar" });
    }
});

router.put("/avatar/select", authMiddleware, async (req, res) => {
    try {
        const { avatar } = req.body; // relative path like "/uploads/filename.jpg"
        if (!avatar) return res.status(400).json({ message: "Avatar not provided" });

        // Check if user has uploaded this avatar before
        const user = await User.findById(req.user._id);
        if (!user.avatars.includes(avatar)) {
            return res.status(400).json({ message: "Avatar not in your uploads" });
        }

        // Set as active avatar
        user.avatar = avatar;
        await user.save();

        res.json({ message: "Avatar updated successfully", avatar: user.avatar });
    } catch (err) {
        console.error("Select avatar error:", err.message);
        res.status(500).json({ message: "Failed to select avatar" });
    }
});

// Delete account
router.delete("/delete", authMiddleware, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.user._id);
        res.json({ message: "Account deleted successfully" });
    } catch (err) {
        console.error("Delete error:", err.message);
        res.status(500).json({ message: "Failed to delete account" });
    }
});

// Increment posts
router.post("/stats/post", authMiddleware, async (req, res) => {
    try {
        const updated = await User.findByIdAndUpdate(
            req.user._id,
            { $inc: { "stats.posts": 1 } }, // increment by 1
            { new: true, select: "-password" }
        );
        res.json(updated.stats);
    } catch (err) {
        console.error("Stats post error:", err.message);
        res.status(500).json({ message: "Failed to update posts" });
    }
});

// Like or Unlike a post
// router.post("/:id/like", authMiddleware, async (req, res) => {
//     try {
//         const post = await Post.findById(req.params.id);
//         if (!post) return res.status(404).json({ message: "Post not found" });

//         // Check if the user has already liked the post
//         const hasLiked = post.likes.includes(req.user._id);

//         if (hasLiked) {
//             // Unlike the post
//             post.likes.pull(req.user._id);
//             await post.save();

//             // Decrement the author's total likes
//             await User.findByIdAndUpdate(post.author, { $inc: { "stats.likes": -1 } });

//             return res.json({ likes: post.likes.length, message: "Post unliked" });
//         } else {
//             // Like the post
//             post.likes.push(req.user._id);
//             await post.save();

//             // Increment the author's total likes
//             await User.findByIdAndUpdate(post.author, { $inc: { "stats.likes": 1 } });

//             return res.json({ likes: post.likes.length, message: "Post liked" });
//         }

//     } catch (err) {
//         console.error("Like error:", err.message);
//         res.status(500).json({ message: "Failed to like post" });
//     }
// });

router.get("/stats", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("stats");
        res.json(user.stats);
    } catch (err) {
        console.error("Stats fetch error:", err.message);
        res.status(500).json({ message: "Failed to fetch stats" });
    }
});


module.exports = router;