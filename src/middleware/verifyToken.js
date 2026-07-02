const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const { collections } = require("../config/db");

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS);

    const email = payload.email ?? null;
    if (!email) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const dbUser = await collections.users.findOne({ email });

    if (!dbUser) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (dbUser.status && dbUser.status !== "active") {
      return res.status(403).json({ message: "Account is not active" });
    }

    req.user = {
      ...payload,
      role: dbUser.role ?? null,
      status: dbUser.status ?? "active",
      _id: dbUser._id ?? null,
    };

    next();
  } catch (error) {
    res.status(403).json({ message: "Forbidden" });
  }
};

module.exports = verifyToken;
