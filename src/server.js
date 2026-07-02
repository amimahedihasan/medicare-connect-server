require("dotenv").config();

const express = require("express");
const cors = require("cors");

const doctorsRoutes = require("./routes/doctors.routes");
const usersRoutes = require("./routes/users.routes");
const appointmentsRoutes = require("./routes/appointments.routes");
const reviewsRoutes = require("./routes/reviews.routes");
const paymentsRoutes = require("./routes/payments.routes");
const prescriptionsRoutes = require("./routes/prescriptions.routes");
const statsRoutes = require("./routes/stats.routes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

// root route
app.get("/", (req, res) => {
  res.send("MediCare Connect Server is running!");
});

// API routes
app.use("/api/doctors", doctorsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/prescriptions", prescriptionsRoutes);
app.use("/api/stats", statsRoutes);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
