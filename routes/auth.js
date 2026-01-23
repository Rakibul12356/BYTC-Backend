const express = require("express");
const router = express.Router();
const { login } = require("../controllers/userController");

// POST /api/auth/login -> delegates to existing userController.login
router.post("/login", login);

module.exports = router;
