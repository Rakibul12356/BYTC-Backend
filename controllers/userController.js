const userService = require("../services/userService");

const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const createUser = async (req, res) => {
  try {
    const user = req.body;
    const result = await userService.createUser(user);
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const register = async (req, res) => {
  try {
    console.log("Register controller: incoming body =", req.body);
    const newUser = await userService.register(req.body);
    console.log("Register controller: created user =", newUser);
    res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    if (err.message === "User already exists")
      return res.status(400).json({ message: err.message });
    res.status(500).json({ message: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    console.log("Login request body:", req.body);
    const auth = await userService.authenticate(req.body);

    // If service returned a structured failure, map to field-specific responses
    if (auth && auth.reason) {
      if (auth.reason === "not_found")
        return res.status(404).json({
          message: auth.message || "Email not registered",
          field: "email",
        });
      if (auth.reason === "invalid_password")
        return res.status(401).json({
          message: auth.message || "Incorrect password",
          field: "password",
        });
      if (auth.reason === "no_password")
        return res.status(400).json({
          message: auth.message || "No password set for this account",
          field: "password",
        });
      // generic error
      if (auth.reason === "error")
        return res.status(500).json({
          message: auth.message || "Authentication error",
          field: "general",
        });
      return res.status(401).json({
        message: auth.message || "Invalid credentials",
        field: "general",
      });
    }

    if (!auth)
      return res
        .status(401)
        .json({ message: "Invalid credentials", field: "general" });

    // Attach a convenient expiresAt timestamp (frontend-friendly ISO string)
    // userService.authenticate issues tokens with 1h expiry (expiresIn: '1h')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    return res.json({ ...auth, expiresAt });
  } catch (err) {
    console.error("Login error (backend):", err && err.stack ? err.stack : err);
    if (err.message && err.message.includes("JWT_SECRET"))
      return res.status(500).json({ message: err.message });
    res.status(500).json({ message: "Server error" });
  }
};

const getMe = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const id = req.user.userId || req.user.id || req.user._id;
    if (!id) return res.status(400).json({ message: "Invalid token payload" });
    const user = await userService.getUserById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getAllUsers, createUser, register, login, getMe };
