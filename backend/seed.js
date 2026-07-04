require("dotenv").config();
const crypto = require("crypto");
const connectDatabase = require("./config/db");
const Counter = require("./models/Counter");
const User = require("./models/User");
const Employee = require("./models/Employee");
const Attendance = require("./models/Attendance");
const Leave = require("./models/Leave");
const Performance = require("./models/Performance");
const seedData = require("./data.json");
const PASSWORD_HASH_PREFIX = "scrypt";

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");

    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(`${PASSWORD_HASH_PREFIX}$${salt}$${derivedKey.toString("hex")}`);
    });
  });
}

async function seed() {
  await connectDatabase();

  await Promise.all([
    Counter.deleteMany({}),
    User.deleteMany({}),
    Employee.deleteMany({}),
    Attendance.deleteMany({}),
    Leave.deleteMany({}),
    Performance.deleteMany({}),
  ]);

  await User.insertMany(
    await Promise.all(
      seedData.users.map(async (user) => ({
        ...user,
        password: await hashPassword(user.password),
      }))
    )
  );
  await Employee.insertMany(seedData.employees);
  await Attendance.insertMany(seedData.attendance);
  await Leave.insertMany(seedData.leaves);
  await Performance.insertMany(seedData.performance);
  await Counter.create({
    name: "employeeId",
    value: seedData.employees.length,
  });

  console.log("MongoDB seed completed successfully");
  process.exit(0);
}

seed().catch((error) => {
  console.error("MongoDB seed failed", error.message);
  process.exit(1);
});
