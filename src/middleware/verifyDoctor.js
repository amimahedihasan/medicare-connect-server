const verifyDoctor = (req, res, next) => {
  try {
    const user = req.user;

    if (!user || user.role !== "doctor") {
      return res.status(403).send({
        message: "Forbidden: Doctors only",
      });
    }

    next();
  } catch (error) {
    res.status(500).send({ message: "Authorization error" });
  }
};

module.exports = verifyDoctor;
