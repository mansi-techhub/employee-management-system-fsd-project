const mongoose = require("mongoose");

const salarySchema = new mongoose.Schema(
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
    employeeName: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    month: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    baseSalary: {
      type: Number,
      required: true,
      default: 0,
    },
    daysInMonth: {
      type: Number,
      required: true,
      default: 0,
    },
    presentDays: {
      type: Number,
      required: true,
      default: 0,
    },
    lateDays: {
      type: Number,
      required: true,
      default: 0,
    },
    latePenaltyDays: {
      type: Number,
      required: true,
      default: 0,
    },
    approvedLeaveDays: {
      type: Number,
      required: true,
      default: 0,
    },
    paidLeavesUsedThisMonth: {
      type: Number,
      required: true,
      default: 0,
    },
    unpaidLeaveDays: {
      type: Number,
      required: true,
      default: 0,
    },
    unpaidLeaveDeductionAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    absentDays: {
      type: Number,
      required: true,
      default: 0,
    },
    absentDeductionAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    workloadRejectionCount: {
      type: Number,
      required: true,
      default: 0,
    },
    workloadPenaltyDays: {
      type: Number,
      required: true,
      default: 0,
    },
    workloadPenaltyAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    remainingPaidLeaves: {
      type: Number,
      required: true,
      default: 0,
    },
    deductionDays: {
      type: Number,
      required: true,
      default: 0,
    },
    deductionAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    netSalary: {
      type: Number,
      required: true,
      default: 0,
    },
    generatedOn: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

salarySchema.index({ organizationId: 1, employeeId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("Salary", salarySchema);
