const verifyAdmin = (req, res, next) => {
  try {
    const user = req.user;

    if (!user || user.role !== "admin") {
      return res.status(403).send({
        message: "Forbidden: Admins only",
      });
    }

    next();
  } catch (error) {
    res.status(500).send({ message: "Authorization error" });
  }
};

module.exports = verifyAdmin;
