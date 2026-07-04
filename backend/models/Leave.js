const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
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
    fromDate: {
      type: String,
      required: true,
    },
    toDate: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    daysCount: {
      type: Number,
      required: true,
    },
    joinDate: {
      type: String,
      required: true,
    },
    rejoiningDate: {
      type: String,
      required: true,
    },
    coverageEmployeeId: {
      type: String,
      trim: true,
      default: "",
    },
    coverageEmployeeName: {
      type: String,
      trim: true,
      default: "",
    },
    coverageCandidates: [
      {
        employeeId: {
          type: String,
          required: true,
          trim: true,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
        priority: {
          type: Number,
          required: true,
        },
        status: {
          type: String,
          enum: ["Pending", "Accepted", "Rejected", "Skipped"],
          default: "Pending",
        },
        respondedOn: {
          type: String,
          default: "",
        },
        warningIssued: {
          type: Boolean,
          default: false,
        },
        penaltyApplied: {
          type: Boolean,
          default: false,
        },
      },
    ],
    currentCoverageIndex: {
      type: Number,
      default: 0,
    },
    currentCoverageEmployeeId: {
      type: String,
      default: "",
      trim: true,
    },
    currentCoverageEmployeeName: {
      type: String,
      default: "",
      trim: true,
    },
    adminActionOn: {
      type: String,
      default: "",
    },
    emergencyContact1: {
      type: String,
      required: true,
      trim: true,
    },
    emergencyContact2: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "Pending Coverage Approval",
        "Pending Admin Approval",
        "Approved",
        "Rejected",
      ],
      default: "Pending Coverage Approval",
    },
    appliedOn: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Leave", leaveSchema);
