require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB, getDB } = require("./config/db");
const userRoutes = require("./routes/users");
const courseRoutes = require("./routes/courses");
const enrollmentRoutes = require("./routes/enrollments");


const app = express();
// Do not call listen in serverless environment (Vercel). We'll export `app` below.

// Middleware
app.use(express.json());

// Enable CORS for frontend. `CLIENT_ORIGIN` may contain a comma-separated
// list of allowed origins (e.g. "http://localhost:5173,https://my-frontend.vercel.app").
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const allowedOrigins = clientOrigin
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (e.g., server-to-server, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"), false);
    },
    credentials: true,
  }),
);

// Simple health route to verify CORS and server availability
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Protected debug route to check presence of required environment variables.
// To use: set `DEBUG_KEY` in your deployment env and send header `x-debug-key: <value>`
// Returns boolean flags only (never returns secret values).
app.get("/api/debug/env", (req, res) => {
  const key = req.headers["x-debug-key"];
  if (!process.env.DEBUG_KEY || key !== process.env.DEBUG_KEY)
    return res.status(403).json({ message: "Forbidden" });
  return res.json({
    hasMongoUri: !!process.env.MONGO_URI,
    hasDbName: !!process.env.DB_NAME,
    hasJwtSecret: !!process.env.JWT_SECRET,
    clientOrigin: process.env.CLIENT_ORIGIN || null,
  });
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/enrollments", enrollmentRoutes);

// Dev-only debug route to list users metadata (email, hasPassword, passwordPrefix)
if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug/users", async (req, res) => {
    try {
      const db = getDB();
      const users = await db.collection("users").find().limit(100).toArray();
      const mapped = users.map((u) => ({
        _id: u._id,
        email: u.email,
        hasPassword: !!u.password,
        passwordPrefix: u.password ? String(u.password).slice(0, 10) : null,
      }));
      res.json({ users: mapped });
    } catch (err) {
      console.error("Debug users error:", err);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
}

// Export the Express app for serverless handlers (Vercel)
module.exports = app;

// Ensure database connection is initiated when running in serverless environments
// (e.g. Vercel). When the file is imported (require.main !== module) we start
// the connection process so `getDB()` won't throw "Database not initialized".
if (require.main !== module) {
  connectDB().catch((err) => {
    console.error("Failed to connect to DB on module load:", err);
  });
}

// Only run server locally (not on Vercel)
if (require.main === module) {
  connectDB()
    .then(() => {
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Database connection error:", err);
      process.exit(1);
    });
}
