const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");

async function createEnrollment(userId, courseId) {
  const db = getDB();
  // prevent duplicate pending/approved enrollments
  const existing = await db.collection("enrollments").findOne({
    userId: new ObjectId(userId),
    courseId: new ObjectId(courseId),
    status: { $in: ["pending", "approved"] },
  });
  if (existing) return { error: "Enrollment already exists" };
  // load course to determine price and teacher
  const course = await db
    .collection("courses")
    .findOne({ _id: new ObjectId(courseId) });
  if (!course) return { error: "Course not found" };

  const price = Number(course.price) || 0;

  // determine teacher ownership; if no teacherId present it's admin-created
  const teacherIdVal = course.teacherId || null;
  const teacherIdObj = teacherIdVal ? new ObjectId(String(teacherIdVal)) : null;

  // calculate shares
  let adminAmount = 0;
  let teacherAmount = 0;
  if (!teacherIdObj) {
    // admin created course -> admin gets full amount
    adminAmount = Number(price.toFixed(2));
    teacherAmount = 0;
  } else {
    // split 40% admin, 60% teacher
    adminAmount = Math.round(price * 0.4 * 100) / 100;
    teacherAmount = Math.round((price - adminAmount) * 100) / 100;
  }

  const doc = {
    userId: new ObjectId(userId),
    courseId: new ObjectId(courseId),
    status: "approved",
    createdAt: new Date(),
    approvedAt: new Date(),
    approver: null,
    updatedAt: new Date(),
    payment: {
      total: price,
      adminAmount,
      teacherAmount,
    },
  };

  const result = await db.collection("enrollments").insertOne(doc);
  doc._id = result.insertedId;

  // record account split for bookkeeping
  const accountDoc = {
    enrollmentId: doc._id,
    courseId: new ObjectId(courseId),
    totalAmount: price,
    adminAmount,
    teacherAmount,
    teacherId: teacherIdObj,
    createdAt: new Date(),
  };
  await db.collection("accounts").insertOne(accountDoc);

  // increment student count on the course document
  try {
    await db
      .collection("courses")
      .updateOne(
        { _id: new ObjectId(courseId) },
        { $inc: { students: 1 }, $set: { updatedAt: new Date() } },
      );
  } catch (e) {
    console.warn("Failed to update course student count", e);
  }

  return doc;
}

async function getUserEnrollments(userId) {
  const db = getDB();
  const enrollments = await db
    .collection("enrollments")
    .aggregate([
      { $match: { userId: new ObjectId(userId), status: "approved" } },
      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
      { $project: { status: 1, createdAt: 1, course: 1 } },
    ])
    .toArray();
  return enrollments;
}

async function getPendingEnrollments() {
  const db = getDB();
  const pending = await db
    .collection("enrollments")
    .aggregate([
      { $match: { status: "pending" } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          status: 1,
          createdAt: 1,
          user: { _id: 1, name: 1, email: 1 },
          course: { _id: 1, title: 1, name: 1 },
        },
      },
    ])
    .toArray();
  return pending;
}

async function approveEnrollment(enrollmentId, adminId) {
  const db = getDB();
  const res = await db.collection("enrollments").findOneAndUpdate(
    { _id: new ObjectId(enrollmentId) },
    {
      $set: {
        status: "approved",
        approvedAt: new Date(),
        approver: new ObjectId(adminId),
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );
  return res.value;
}

module.exports = {
  createEnrollment,
  getUserEnrollments,
  getPendingEnrollments,
  approveEnrollment,
};
