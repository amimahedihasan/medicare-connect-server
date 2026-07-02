const express = require("express");

const { collections } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

const router = express.Router();

/**
 * Public Stats
 */
router.get("/public", async (req, res) => {
  try {
    const [totalDoctors, totalPatients, totalAppointments, totalReviews] =
      await Promise.all([
        collections.doctors.countDocuments(),
        collections.users.countDocuments({ role: "patient" }),
        collections.appointments.countDocuments(),
        collections.reviews.countDocuments(),
      ]);

    res.send({
      stats: [
        { value: `${totalDoctors}+`, label: "Verified Doctors" },
        { value: `${totalPatients}+`, label: "Happy Patients" },
        { value: `${totalAppointments}+`, label: "Monthly Appointments" },
        { value: `${totalReviews}+`, label: "Positive Reviews" },
      ],
    });
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch public stats" });
  }
});

/**
 * Admin Analytics Stats
 */
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [totalDoctors, totalPatients, totalAppointments, totalReviews] =
      await Promise.all([
        collections.doctors.countDocuments(),
        collections.users.countDocuments({ role: "patient" }),
        collections.appointments.countDocuments(),
        collections.reviews.countDocuments(),
      ]);

    const appointmentStats = await collections.appointments
      .aggregate([
        { $group: { _id: "$appointmentStatus", count: { $sum: 1 } } },
        { $project: { _id: 0, status: "$_id", count: 1 } },
      ])
      .toArray();

    const specializationStats = await collections.doctors
      .aggregate([
        { $group: { _id: "$specialization", count: { $sum: 1 } } },
        { $project: { _id: 0, specialization: "$_id", count: 1 } },
      ])
      .toArray();

    res.send({
      totalDoctors,
      totalPatients,
      totalAppointments,
      totalReviews,
      appointmentStats,
      specializationStats,
    });
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch stats" });
  }
});

module.exports = router;
