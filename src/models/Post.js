// server/src/models/Post.js
const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        readingTime: { type: String, default: "Quick" },
        image: { type: String },
        description: { type: String, trim: true },
        content: { type: String, required: true },
        tags: {
            type: [String],
            default: [],
        },
        links: {
            type: [String],
            default: [],
        },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // users who liked the post
    },
    { timestamps: true }
);

module.exports = mongoose.model("Post", PostSchema);