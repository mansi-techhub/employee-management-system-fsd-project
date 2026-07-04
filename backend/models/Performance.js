const mongoose = require("mongoose");

const performanceSchema = new mongoose.Schema(
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
    month: {
      type: String,
      required: true,
    },
    rating: {
      type: String,
      enum: ["Excellent", "Good", "Average", "Needs Improvement"],
      required: true,
    },
    review: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Performance", performanceSchema);
