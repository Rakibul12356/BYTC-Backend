const { getDB, connectDB } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");

const getAllUsers = async () => {
  let db;
  try {
    db = getDB();
  } catch (e) {
    await connectDB();
    db = getDB();
  }
  const users = await db.collection("users").find().toArray();
  // remove password before returning
  return users.map(({ password, ...rest }) => rest);
};

const createUser = async (userData) => {
  let db;
  try {
    db = getDB();
  } catch (e) {
    await connectDB();
    db = getDB();
  }
  return await db.collection("users").insertOne(userData);
};

const register = async ({ name, email, password, role }) => {
  let db;
  try {
    db = getDB();
  } catch (e) {
    await connectDB();
    db = getDB();
  }
  const emailNorm =
    email && typeof email === "string"
      ? String(email).trim().toLowerCase()
      : "";
  // ensure we check and store using normalized (lowercased) email to avoid duplicates
  const existing = await db.collection("users").findOne({ email: emailNorm });
  if (existing) throw new Error("User already exists");
  const hashed = await bcrypt.hash(password, 10);
  // normalize role: allow only 'student' or 'teacher', default to 'student'
  const incoming =
    role && typeof role === "string" ? String(role).trim().toLowerCase() : "";
  const allowed = ["student", "teacher"];
  const finalRole = allowed.includes(incoming) ? incoming : "student";
  console.log(
    "Register: incoming role=",
    JSON.stringify(role),
    "normalized=",
    incoming,
    "finalRole=",
    finalRole,
  );

  const user = {
    name,
    email: emailNorm,
    password: hashed,
    role: finalRole,
    createdAt: new Date(),
  };
  const result = await db.collection("users").insertOne(user);
  user._id = result.insertedId;
  delete user.password;
  return user;
};

const authenticate = async ({ email, password }) => {
  let db;
  try {
    db = getDB();
  } catch (e) {
    await connectDB();
    db = getDB();
  }
  const emailNorm =
    email && typeof email === "string"
      ? String(email).trim().toLowerCase()
      : "";
  const user = await db.collection("users").findOne({ email: emailNorm });
  console.log(
    "authenticate: found user?",
    !!user,
    "email:",
    emailNorm,
    "userId:",
    user?._id,
    "role:",
    user?._doc?.role || user?.role,
    "hasPassword:",
    !!(user && user.password),
  );
  if (!user) return { reason: "not_found", message: "Email not registered" };
  if (!user.password) {
    console.warn(
      "authenticate: user has no password field, cannot verify password",
      email,
    );
    return {
      reason: "no_password",
      message: "No password set for this account",
    };
  }
  // Log a small prefix and whether it looks like a bcrypt hash for debugging
  try {
    console.log(
      "stored password prefix:",
      typeof user.password === "string"
        ? String(user.password).slice(0, 8)
        : typeof user.password,
    );
    console.log(
      "password looks like bcrypt:",
      typeof user.password === "string" && user.password.startsWith("$2"),
    );
  } catch (e) {
    console.error("Error inspecting stored password for", email, e);
  }
  let match = false;
  try {
    match = await bcrypt.compare(password, user.password);
    console.log("bcrypt compare result:", match, "for email:", email);
  } catch (e) {
    console.error("bcrypt compare error for", email, e);
    return { reason: "error", message: "Authentication error" };
  }
  if (!match) {
    console.log("Password mismatch for:", email);
    return { reason: "invalid_password", message: "Incorrect password" };
  }
  console.log("Password matched! Generating JWT...");
  // Provide a development fallback for JWT secret to avoid 500s during local testing.
  // Default to dev mode if NODE_ENV is not set
  const isProduction = process.env.NODE_ENV === "production";
  const secret =
    process.env.JWT_SECRET || (isProduction ? null : "dev_jwt_secret");
  if (!secret) throw new Error("JWT_SECRET not set in .env");
  const token = jwt.sign({ userId: user._id, email: user.email }, secret, {
    expiresIn: "1h",
  });
  const safeUser = { ...user };
  delete safeUser.password;
  return { user: safeUser, token };
};

const getUserById = async (id) => {
  let db;
  try {
    db = getDB();
  } catch (e) {
    await connectDB();
    db = getDB();
  }
  try {
    const _id = typeof id === "string" ? new ObjectId(id) : id;
    const user = await db.collection("users").findOne({ _id });
    if (!user) return null;
    const { password, ...rest } = user;
    return rest;
  } catch (e) {
    return null;
  }
};

module.exports = {
  getAllUsers,
  createUser,
  register,
  authenticate,
  getUserById,
};
