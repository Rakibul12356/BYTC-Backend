const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");

async function getPlatformStats() {
  const db = getDB();

  // total students
  const totalStudents = await db
    .collection("users")
    .countDocuments({ role: { $regex: /^student$/i } });

  // total revenue (sum of accounts.totalAmount)
  const revenueAgg = await db
    .collection("accounts")
    .aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }])
    .toArray();
  const totalRevenue =
    revenueAgg[0] && revenueAgg[0].total ? revenueAgg[0].total : 0;

  // active courses (simple count)
  const activeCourses = await db.collection("courses").countDocuments();

  // completion rate = approved enrollments / total enrollments
  const enrollAgg = await db
    .collection("enrollments")
    .aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
        },
      },
    ])
    .toArray();
  const totalEnrollments =
    enrollAgg[0] && enrollAgg[0].total ? enrollAgg[0].total : 0;
  const approvedEnrollments =
    enrollAgg[0] && enrollAgg[0].approved ? enrollAgg[0].approved : 0;
  const completionRate =
    totalEnrollments === 0
      ? 0
      : Math.round((approvedEnrollments / totalEnrollments) * 1000) / 10; // one decimal

  return {
    totalStudents,
    totalRevenue,
    activeCourses,
    completionRate,
  };
}

module.exports = { getPlatformStats };
