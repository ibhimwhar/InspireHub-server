// server/src/main.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const connectDB = require("./db/connection.js");
const authRoute = require("./routes/authRoute.js");
const blogRoute = require("./routes/blogRoute.js");

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Mongo
connectDB();

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*", credentials: true }));
app.use(morgan("dev"));
app.use(express.json());

// Serve uploaded files statically
app.use("/uploads", express.static(uploadDir));

// Routes
app.use("/auth", authRoute);
app.use("/", blogRoute);

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
