const verifyPatient = (req, res, next) => {
  try {
    const user = req.user;

    if (!user || user.role !== "patient") {
      return res.status(403).send({
        message: "Forbidden: Patients only",
      });
    }

    next();
  } catch (error) {
    res.status(500).send({ message: "Authorization error" });
  }
};

module.exports = verifyPatient;
