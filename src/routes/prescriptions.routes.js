const express = require("express");
const { ObjectId } = require("mongodb");

const { collections } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const verifyDoctor = require("../middleware/verifyDoctor");
const verifyPatient = require("../middleware/verifyPatient");

const router = express.Router();

/**
 * GET prescriptions (doctor's own)
 */
router.get("/", verifyToken, verifyDoctor, async (req, res) => {
  try {
    const email = req.user?.email;
    const doctor = email ? await collections.doctors.findOne({ email }) : null;

    if (!doctor) {
      return res
        .status(403)
        .send({ message: "Unable to identify doctor profile" });
    }

    const query = { doctorId: doctor._id.toString() };

    if (req.query.patientId) query.patientId = req.query.patientId;
    if (req.query.appointmentId) query.appointmentId = req.query.appointmentId;

    const prescriptions = await collections.prescriptions.find(query).toArray();
    res.send(prescriptions);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch prescriptions" });
  }
});

/**
 * GET logged-in patient's own prescriptions
 */
router.get("/mine", verifyToken, verifyPatient, async (req, res) => {
  try {
    const patientId = req.user?._id;

    if (!patientId) {
      return res
        .status(401)
        .send({ message: "Unable to identify patient from token" });
    }

    const query = { patientId: patientId.toString() };
    if (req.query.appointmentId) query.appointmentId = req.query.appointmentId;

    const prescriptions = await collections.prescriptions.find(query).toArray();
    res.send(prescriptions);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch prescriptions" });
  }
});

/**
 * CREATE prescription
 */
router.post("/", verifyToken, verifyDoctor, async (req, res) => {
  try {
    const prescription = { ...req.body, createdAt: new Date() };
    const result = await collections.prescriptions.insertOne(prescription);
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to create prescription" });
  }
});

/**
 * UPDATE prescription
 */
router.patch("/:id", verifyToken, verifyDoctor, async (req, res) => {
  try {
    const result = await collections.prescriptions.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body },
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to update prescription" });
  }
});

/**
 * DELETE prescription
 */
router.delete("/:id", verifyToken, verifyDoctor, async (req, res) => {
  try {
    const result = await collections.prescriptions.deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to delete prescription" });
  }
});

module.exports = router;
