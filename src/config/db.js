const { MongoClient, ServerApiVersion } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Connect once — MongoDB driver handles timing automatically
client.connect().catch(console.error);

const db = client.db(process.env.DB_NAME);

const collections = {
  users: db.collection("user"),
  doctors: db.collection("doctors"),
  appointments: db.collection("appointments"),
  payments: db.collection("payments"),
  prescriptions: db.collection("prescriptions"),
  reviews: db.collection("reviews"),
};

module.exports = { client, db, collections };
