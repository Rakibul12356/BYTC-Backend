const courseService = require("../services/courseService");

const getAllCourses = async (req, res) => {
  try {
    const courses = await courseService.getAllCourses();
    res.json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getCourseById = async (req, res) => {
  try {
    const course = await courseService.getCourseById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const createCourse = async (req, res) => {
  try {
    // Require authenticated user and allow only teachers or admins
    const user = req.user || null;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = String(user.role || "").toLowerCase();
    if (role !== "teacher" && role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only teachers or admins can create courses" });
    }

    const course = req.body;
    // If teacher, attach teacherId if not provided
    if (role === "teacher") {
      course.teacherId = course.teacherId || user.userId || user._id || null;
    }

    console.log("Creating course:", { role, teacherId: course.teacherId });
    const result = await courseService.createCourse(course);
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const updateCourse = async (req, res) => {
  try {
    const result = await courseService.updateCourse(req.params.id, req.body);
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.json({ message: "Course updated successfully", result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const result = await courseService.deleteCourse(req.params.id);
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.json({ message: "Course deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
};
