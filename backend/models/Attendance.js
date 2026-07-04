const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    organizationId: {
      type: String,
      default: "",
      index: true,
      trim: true,
    },
    date: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["Present", "Late", "Absent"],
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Attendance", attendanceSchema);
