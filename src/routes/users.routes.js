const express = require("express");
const { ObjectId } = require("mongodb");

const { collections } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

const router = express.Router();

/**
 * GET all users (ADMIN ONLY)
 */
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await collections.users.find().toArray();
    res.send(users);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch users" });
  }
});

/**
 * GET current logged-in user
 */
router.get("/me", verifyToken, async (req, res) => {
  try {
    const email = req.user?.email;

    if (!email) {
      return res.status(400).send({ message: "Invalid token payload" });
    }

    const user = await collections.users.findOne({ email });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send(user);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch user" });
  }
});

/**
 * CREATE user
 */
router.post("/", async (req, res) => {
  try {
    const user = {
      ...req.body,
      role: req.body.role || "patient",
      status: "active",
      createdAt: new Date(),
    };

    const result = await collections.users.insertOne(user);
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to create user" });
  }
});

/**
 * GET user by ID (PUBLIC)
 */
router.get("/:id", async (req, res) => {
  try {
    const user = await collections.users.findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { name: 1, image: 1, role: 1 } },
    );

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send(user);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch user" });
  }
});

/**
 * UPDATE user profile
 */
router.patch("/:id", verifyToken, async (req, res) => {
  try {
    const result = await collections.users.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body },
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to update user" });
  }
});

/**
 * SUSPEND USER (ADMIN ONLY)
 */
router.patch("/:id/suspend", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await collections.users.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: "suspended" } },
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to suspend user" });
  }
});

/**
 * DELETE USER (ADMIN ONLY)
 */
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    const userToDelete = await collections.users.findOne({
      _id: new ObjectId(userId),
    });

    const result = await collections.users.deleteOne({
      _id: new ObjectId(userId),
    });

    if (userToDelete?.role === "doctor") {
      await collections.doctors.deleteOne({ userId });
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to delete user" });
  }
});

module.exports = router;
