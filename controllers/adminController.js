const adminService = require("../services/adminService");

async function getStats(req, res) {
  try {
    // only allow admin
    if (!req.user || String(req.user.role || "").toLowerCase() !== "admin")
      return res.status(403).json({ message: "Forbidden" });

    const stats = await adminService.getPlatformStats();
    res.json(stats);
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { getStats };
