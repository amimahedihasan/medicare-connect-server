const express = require("express");
const { ObjectId } = require("mongodb");

const { collections } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const verifyPatient = require("../middleware/verifyPatient");

const router = express.Router();

/**
 * Recalculate doctor rating & review count
 */
const updateDoctorRating = async (doctorId) => {
  const reviews = await collections.reviews.find({ doctorId }).toArray();

  const totalReviews = reviews.length;
  const avgRating =
    totalReviews === 0
      ? 0
      : reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

  await collections.doctors.updateOne(
    { _id: new ObjectId(doctorId) },
    { $set: { rating: Number(avgRating.toFixed(2)), totalReviews } },
  );
};

/**
 * GET reviews
 */
router.get("/", async (req, res) => {
  try {
    const query = {};
    if (req.query.doctorId) query.doctorId = req.query.doctorId;
    if (req.query.patientId) query.patientId = req.query.patientId;

    let cursor = collections.reviews.find(query).sort({ createdAt: -1 });

    const limit = Number(req.query.limit);
    if (Number.isFinite(limit) && limit > 0) {
      cursor = cursor.limit(limit);
    }

    const reviews = await cursor.toArray();
    res.send(reviews);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch reviews" });
  }
});

/**
 * CREATE review
 */
router.post("/", verifyToken, verifyPatient, async (req, res) => {
  try {
    const review = {
      doctorId: req.body.doctorId,
      patientId: req.body.patientId,
      rating: Number(req.body.rating),
      reviewText: req.body.reviewText,
      createdAt: new Date(),
    };

    const result = await collections.reviews.insertOne(review);
    await updateDoctorRating(review.doctorId);

    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to create review" });
  }
});

/**
 * UPDATE review
 */
router.patch("/:id", verifyToken, verifyPatient, async (req, res) => {
  try {
    const existing = await collections.reviews.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!existing) {
      return res.status(404).send({ message: "Review not found" });
    }

    await collections.reviews.updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          rating: Number(req.body.rating),
          reviewText: req.body.reviewText,
        },
      },
    );

    await updateDoctorRating(existing.doctorId);
    res.send({ message: "Review updated" });
  } catch (error) {
    res.status(500).send({ message: "Failed to update review" });
  }
});

/**
 * DELETE review
 */
router.delete("/:id", verifyToken, verifyPatient, async (req, res) => {
  try {
    const review = await collections.reviews.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!review) {
      return res.status(404).send({ message: "Review not found" });
    }

    await collections.reviews.deleteOne({ _id: new ObjectId(req.params.id) });
    await updateDoctorRating(review.doctorId);

    res.send({ message: "Review deleted" });
  } catch (error) {
    res.status(500).send({ message: "Failed to delete review" });
  }
});

module.exports = router;
