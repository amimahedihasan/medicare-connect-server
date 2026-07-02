const express = require("express");
const { ObjectId } = require("mongodb");
const Stripe = require("stripe");

const { collections } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const verifyPatient = require("../middleware/verifyPatient");
const verifyAdmin = require("../middleware/verifyAdmin");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Allow both patients and admins
 */
const verifyPatientOrAdmin = (req, res, next) => {
  if (req.user?.role === "patient" || req.user?.role === "admin") {
    return next();
  }
  return res.status(403).send({ message: "Access denied" });
};

/**
 * Create Stripe Checkout Session
 */
router.post(
  "/create-checkout-session",
  verifyToken,
  verifyPatient,
  async (req, res) => {
    try {
      const { appointmentId, doctorId, amount } = req.body;

      const doctor = await collections.doctors.findOne({
        _id: new ObjectId(doctorId),
      });
      const doctorName = doctor?.doctorName || "Your Doctor";

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `Appointment with ${doctorName}` },
              unit_amount: amount * 100,
            },
            quantity: 1,
          },
        ],
        metadata: { appointmentId },
        success_url: `${process.env.CLIENT_URL}/payment-success?appointmentId=${appointmentId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/payment-cancelled?appointmentId=${appointmentId}`,
      });

      res.send({ url: session.url });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Failed to create checkout session" });
    }
  },
);

/**
 * GET payments
 */
router.get("/", verifyToken, verifyPatientOrAdmin, async (req, res) => {
  try {
    const query = {};
    const isAdmin = req.user?.role === "admin";

    if (isAdmin) {
      if (req.query.patientId) query.patientId = req.query.patientId;
      if (req.query.doctorId) query.doctorId = req.query.doctorId;
      if (req.query.appointmentId)
        query.appointmentId = req.query.appointmentId;
    } else {
      const patientId = req.user?.id || req.user?._id;

      if (!patientId) {
        return res
          .status(401)
          .send({ message: "Unable to identify patient from token" });
      }

      query.patientId = patientId.toString();
    }

    const payments = await collections.payments.find(query).toArray();
    res.send(payments);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch payments" });
  }
});

/**
 * Record successful payment
 */
router.post("/", verifyToken, verifyPatient, async (req, res) => {
  try {
    const { appointmentId, amount, sessionId } = req.body;

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.latest_charge"],
    });

    const appointment = await collections.appointments.findOne({
      _id: new ObjectId(appointmentId),
    });

    if (!appointment) {
      return res.status(404).send({ message: "Appointment not found" });
    }

    const existingPayment = await collections.payments.findOne({
      appointmentId,
    });

    if (existingPayment?.paymentStatus === "paid") {
      return res.status(400).send({ message: "Payment already exists" });
    }

    const updateFields = {
      appointmentId,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      amount: Number(amount),
      paymentMethod: "stripe",
      paymentStatus: "paid",
      transactionId: session.payment_intent.id,
      chargeId: session.payment_intent.latest_charge.id,
      stripeSessionId: sessionId,
      paymentDate: new Date(),
      updatedAt: new Date(),
    };

    let result;
    if (existingPayment) {
      result = await collections.payments.updateOne(
        { appointmentId },
        { $set: updateFields },
      );
    } else {
      result = await collections.payments.insertOne({
        ...updateFields,
        createdAt: new Date(),
      });
    }

    await collections.appointments.updateOne(
      { _id: new ObjectId(appointmentId) },
      { $set: { paymentStatus: "paid", appointmentStatus: "accepted" } },
    );

    res.status(201).send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to create payment" });
  }
});

module.exports = router;
