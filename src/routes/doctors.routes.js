const express = require("express");
const { ObjectId } = require("mongodb");

const { collections } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");
const verifyDoctor = require("../middleware/verifyDoctor");

const router = express.Router();

/**
 * GET /api/doctors
 *
 * Query params:
 * - search
 * - specialization
 * - page
 * - limit
 * - sortBy = consultationFee | experience | rating
 * - order = asc | desc
 */
router.get("/", async (req, res) => {
  try {
    const {
      search,
      specialization,
      page = 1,
      limit = 12,
      sortBy,
      order = "asc",
    } = req.query;

    const query = { verificationStatus: "verified" };

    if (specialization) {
      query.specialization = specialization;
    }

    if (search) {
      query.$or = [
        { doctorName: { $regex: search, $options: "i" } },
        { specialization: { $regex: search, $options: "i" } },
      ];
    }

    const sort = {};
    if (["consultationFee", "experience", "rating"].includes(sortBy)) {
      sort[sortBy] = order === "desc" ? -1 : 1;
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    const total = await collections.doctors.countDocuments(query);
    const doctors = await collections.doctors
      .find(query)
      .sort(sort)
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber)
      .toArray();

    res.send({ total, page: pageNumber, limit: limitNumber, doctors });
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch doctors" });
  }
});

/**
 * GET all doctors (ADMIN ONLY)
 */
router.get("/all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const doctors = await collections.doctors.find({}).toArray();
    res.send({ doctors });
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch doctors" });
  }
});

/**
 * GET logged-in doctor's profile
 */
router.get("/me", verifyToken, verifyDoctor, async (req, res) => {
  try {
    const email = req.user?.email;
    const doctor = await collections.doctors.findOne({ email });

    if (!doctor) {
      return res.status(404).send({ message: "Doctor profile not found" });
    }

    res.send(doctor);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch doctor profile" });
  }
});

/**
 * GET doctor by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const doctor = await collections.doctors.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!doctor) {
      return res.status(404).send({ message: "Doctor not found" });
    }

    res.send(doctor);
  } catch (error) {
    res.status(400).send({ message: "Invalid doctor id" });
  }
});

/**
 * CREATE doctor profile
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const doctor = {
      ...req.body,
      verificationStatus: "pending",
      rating: 0,
      totalReviews: 0,
      createdAt: new Date(),
    };

    const result = await collections.doctors.insertOne(doctor);
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to create doctor profile" });
  }
});

/**
 * UPDATE doctor profile
 */
router.patch("/:id", verifyToken, verifyDoctor, async (req, res) => {
  try {
    const result = await collections.doctors.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...req.body, updatedAt: new Date() } },
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to update doctor profile" });
  }
});

/**
 * DELETE doctor
 */
router.delete("/:id", verifyToken, verifyDoctor, async (req, res) => {
  try {
    const result = await collections.doctors.deleteOne({
      _id: new ObjectId(req.params.id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to delete doctor" });
  }
});

/**
 * Admin verifies/rejects doctor
 */
router.patch(
  "/:id/verification",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { verificationStatus } = req.body;

      if (!["verified", "rejected", "pending"].includes(verificationStatus)) {
        return res.status(400).send({ message: "Invalid verification status" });
      }

      const result = await collections.doctors.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { verificationStatus, updatedAt: new Date() } },
      );

      res.send(result);
    } catch (error) {
      res.status(500).send({ message: "Failed to update verification status" });
    }
  },
);

module.exports = router;
