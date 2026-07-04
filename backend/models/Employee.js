const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    organizationId: {
      type: String,
      default: "",
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    contactNumber: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    department: {
      type: String,
      required: true,
    },
    designation: {
      type: String,
      required: true,
    },
    salary: {
      type: Number,
      required: true,
    },
    joinDate: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: "Active",
    },
    manager: {
      type: String,
      default: "Unassigned",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Employee", employeeSchema);
