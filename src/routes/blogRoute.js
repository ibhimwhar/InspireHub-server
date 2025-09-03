const express = require("express");
const multer = require("multer");
const path = require("path");
const Post = require("../models/Post.js");
const authMiddleware = require("../middleware/authMiddleware.js");

const router = express.Router();

// Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + "-" + file.originalname);
    },
});
const upload = multer({ storage });

// ✅ Create new blog
router.post("/blogs", authMiddleware, upload.single("image"), async (req, res) => {
    try {
        const postData = {
            title: req.body.title,
            description: req.body.description,
            content: req.body.content,
            readingTime: req.body.readingTime,
            tags: req.body.tags ? req.body.tags.split(",").map(t => t.trim()) : [],
            links: req.body.links ? req.body.links.split(",").map(l => l.trim()) : [],
            author: req.user._id,
        };

        // ✅ Just save relative path
        if (req.file) {
            const baseUrl = `${req.protocol}://${req.get("host")}`;
            postData.image = `${baseUrl}/uploads/${req.file.filename}`;
        }


        const newPost = await Post.create(postData);
        await newPost.populate("author", "username avatar");

        res.status(201).json(newPost);
    } catch (err) {
        console.error("Create blog error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});


// ✅ Get all blogs
router.get("/blogs", async (req, res) => {
    try {
        const posts = await Post.find()
            .populate("author", "username avatar")
            .sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        console.error("Fetch blogs error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

// ✅ Get single blog
router.get("/blogs/:id", async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate("author", "username avatar");
        if (!post) return res.status(404).json({ message: "Blog not found" });
        res.json(post);
    } catch (err) {
        console.error("Fetch blog error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
