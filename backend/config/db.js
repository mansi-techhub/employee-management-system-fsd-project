const mongoose = require("mongoose");

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/employee_management_system";

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected successfully");
}

module.exports = connectDatabase;
