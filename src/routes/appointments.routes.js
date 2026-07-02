const express = require("express");
const { ObjectId } = require("mongodb");

const { collections } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const verifyPatient = require("../middleware/verifyPatient");
const verifyDoctor = require("../middleware/verifyDoctor");

const router = express.Router();

/**
 * GET appointments
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const role = req.user?.role;
    const query = {};

    if (role === "admin") {
      if (req.query.patientId) query.patientId = req.query.patientId;
      if (req.query.doctorId) query.doctorId = req.query.doctorId;
    } else if (role === "doctor") {
      const email = req.user?.email;
      const doctor = email
        ? await collections.doctors.findOne({ email })
        : null;

      if (!doctor) {
        return res
          .status(403)
          .send({ message: "Unable to identify doctor profile" });
      }

      query.doctorId = doctor._id.toString();
    } else {
      const patientId = req.user?._id;

      if (!patientId) {
        return res
          .status(401)
          .send({ message: "Unable to identify patient from token" });
      }

      query.patientId = patientId.toString();
    }

    if (req.query.appointmentStatus) {
      query.appointmentStatus = req.query.appointmentStatus;
    }

    const appointments = await collections.appointments.find(query).toArray();
    res.send(appointments);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch appointments" });
  }
});

/**
 * GET available slots for a doctor on a specific date
 */
router.get("/available-slots", async (req, res) => {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId || !date) {
      return res
        .status(400)
        .send({ message: "doctorId and date are required" });
    }

    const doctor = await collections.doctors.findOne({
      _id: new ObjectId(doctorId),
    });

    if (!doctor) {
      return res.status(404).send({ message: "Doctor not found" });
    }

    const allSlots = doctor.availableSlots || [];

    const bookedAppointments = await collections.appointments
      .find({
        doctorId,
        appointmentDate: date,
        appointmentStatus: { $nin: ["cancelled", "rejected"] },
      })
      .toArray();

    const bookedSlots = bookedAppointments.map((a) => a.appointmentTime);
    const availableSlots = allSlots.filter(
      (slot) => !bookedSlots.includes(slot),
    );

    res.send({ date, availableSlots });
  } catch (error) {
    res.status(500).send({ message: "Failed to get available slots" });
  }
});

/**
 * GET single appointment
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const appointment = await collections.appointments.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!appointment) {
      return res.status(404).send({ message: "Appointment not found" });
    }

    res.send(appointment);
  } catch (error) {
    res.status(400).send({ message: "Invalid appointment ID" });
  }
});

/**
 * CREATE appointment
 */
router.post("/", verifyToken, verifyPatient, async (req, res) => {
  try {
    const { doctorId, appointmentDate, appointmentTime, patientId } = req.body;

    const existingAppointment = await collections.appointments.findOne({
      doctorId,
      appointmentDate,
      appointmentTime,
      appointmentStatus: { $nin: ["cancelled", "rejected"] },
    });

    if (existingAppointment) {
      return res.status(409).send({ message: "This slot is already booked" });
    }

    let consultationFee = 0;
    try {
      const doctor = await collections.doctors.findOne({
        _id: new ObjectId(doctorId),
      });
      if (doctor?.consultationFee) {
        consultationFee = Number(doctor.consultationFee);
      }
    } catch (lookupError) {
      console.error("Failed to look up doctor consultation fee:", lookupError);
    }

    const appointment = {
      ...req.body,
      appointmentStatus: "pending",
      paymentStatus: "unpaid",
      createdAt: new Date(),
    };

    const result = await collections.appointments.insertOne(appointment);
    const appointmentId = result.insertedId.toString();

    const pendingPayment = {
      appointmentId,
      doctorId,
      patientId: patientId || req.user?.patientId || null,
      amount: consultationFee,
      paymentMethod: null,
      paymentStatus: "pending",
      transactionId: null,
      paymentDate: null,
      createdAt: new Date(),
    };

    try {
      await collections.payments.insertOne(pendingPayment);
    } catch (paymentError) {
      console.error("Failed to create pending payment record:", paymentError);
    }

    res.status(201).send({ appointmentId });
  } catch (error) {
    res.status(500).send({ message: "Failed to create appointment" });
  }
});

/**
 * RESCHEDULE appointment
 */
router.patch(
  "/:id/reschedule",
  verifyToken,
  verifyPatient,
  async (req, res) => {
    try {
      const { appointmentDate, appointmentTime } = req.body;

      const result = await collections.appointments.updateOne(
        { _id: new ObjectId(req.params.id) },
        {
          $set: {
            appointmentDate,
            appointmentTime,
            appointmentStatus: "rescheduled",
            updatedAt: new Date(),
          },
        },
      );

      res.send(result);
    } catch (error) {
      res.status(500).send({ message: "Failed to reschedule appointment" });
    }
  },
);

/**
 * CANCEL appointment
 */
router.patch("/:id/cancel", verifyToken, verifyPatient, async (req, res) => {
  try {
    const result = await collections.appointments.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { appointmentStatus: "cancelled", updatedAt: new Date() } },
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to cancel appointment" });
  }
});

/**
 * DOCTOR: ACCEPT appointment
 */
router.patch("/:id/accept", verifyToken, verifyDoctor, async (req, res) => {
  try {
    const result = await collections.appointments.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { appointmentStatus: "accepted", updatedAt: new Date() } },
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to accept appointment" });
  }
});

/**
 * DOCTOR: REJECT appointment
 */
router.patch("/:id/reject", verifyToken, verifyDoctor, async (req, res) => {
  try {
    const result = await collections.appointments.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { appointmentStatus: "rejected", updatedAt: new Date() } },
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to reject appointment" });
  }
});

/**
 * DOCTOR: MARK COMPLETED
 */
router.patch("/:id/complete", verifyToken, verifyDoctor, async (req, res) => {
  try {
    const result = await collections.appointments.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { appointmentStatus: "completed", updatedAt: new Date() } },
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to complete appointment" });
  }
});

/**
 * DELETE appointment
 */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const result = await collections.appointments.deleteOne({
      _id: new ObjectId(req.params.id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to delete appointment" });
  }
});

module.exports = router;
