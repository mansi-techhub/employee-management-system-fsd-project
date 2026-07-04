require("dotenv").config();
const connectDatabase = require("./config/db");
const Employee = require("./models/Employee");
const Attendance = require("./models/Attendance");
const Leave = require("./models/Leave");
const Salary = require("./models/Salary");

function formatDate(date) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
}

function getMonthRange(monthValue) {
  const normalizedMonth = /^\d{4}-\d{2}$/.test(String(monthValue || ""))
    ? `${monthValue}-01T00:00:00`
    : null;
  const parsedMonth = normalizedMonth ? new Date(normalizedMonth) : new Date();
  const now = Number.isNaN(parsedMonth.getTime()) ? new Date() : parsedMonth;
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const previousEnd = new Date(year, month, 0);

  return {
    label: `${year}-${String(month + 1).padStart(2, "0")}`,
    yearStart: `${year}-01-01`,
    monthStart: formatDate(start),
    monthEnd: formatDate(end),
    previousMonthEnd: month === 0 ? `${year - 1}-12-31` : formatDate(previousEnd),
    daysInMonth: end.getDate(),
  };
}

function calculateInclusiveDays(fromDate, toDate) {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  const millisecondsInDay = 24 * 60 * 60 * 1000;
  return Math.floor((end - start) / millisecondsInDay) + 1;
}

function getLeaveDaysCount(leave) {
  const storedDaysCount = Number(leave?.daysCount);

  if (!Number.isNaN(storedDaysCount) && storedDaysCount > 0) {
    return storedDaysCount;
  }

  if (!leave?.fromDate || !leave?.toDate) {
    return 0;
  }

  const calculatedDays = calculateInclusiveDays(leave.fromDate, leave.toDate);
  return Number.isNaN(calculatedDays) || calculatedDays < 1 ? 0 : calculatedDays;
}

function getDateRangeOverlapDays(fromDate, toDate, rangeStart, rangeEnd) {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  const overlapStart = new Date(rangeStart > fromDate ? rangeStart : fromDate);
  const overlapEnd = new Date(rangeEnd < toDate ? rangeEnd : toDate);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    Number.isNaN(overlapStart.getTime()) ||
    Number.isNaN(overlapEnd.getTime()) ||
    overlapStart > overlapEnd
  ) {
    return 0;
  }

  return calculateInclusiveDays(formatDate(overlapStart), formatDate(overlapEnd));
}

function buildDateSetFromRange(fromDate, toDate, rangeStart, rangeEnd) {
  const days = new Set();
  const start = new Date(fromDate);
  const end = new Date(toDate);
  const overlapStart = new Date(rangeStart > fromDate ? rangeStart : fromDate);
  const overlapEnd = new Date(rangeEnd < toDate ? rangeEnd : toDate);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    Number.isNaN(overlapStart.getTime()) ||
    Number.isNaN(overlapEnd.getTime()) ||
    overlapStart > overlapEnd ||
    start > end
  ) {
    return days;
  }

  const current = new Date(overlapStart);
  while (current <= overlapEnd) {
    days.add(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function calculateSalaryRecord(employee, attendanceRecords, leaveRecords, monthValue) {
  const monthlySalary = Number(employee.salary || 0);
  const monthRange = getMonthRange(monthValue);
  const approvedLeaves = leaveRecords.filter((leave) => leave.status === "Approved");
  const paidLeaveAllowance = 24;

  const approvedLeaveDaysBeforeMonth = approvedLeaves.reduce(
    (sum, leave) => sum + getDateRangeOverlapDays(leave.fromDate, leave.toDate, monthRange.yearStart, monthRange.previousMonthEnd),
    0
  );
  const approvedLeaveDaysCurrentMonth = approvedLeaves.reduce(
    (sum, leave) => sum + getDateRangeOverlapDays(leave.fromDate, leave.toDate, monthRange.monthStart, monthRange.monthEnd),
    0
  );

  const leaveDatesCurrentMonth = approvedLeaves.reduce((days, leave) => {
    buildDateSetFromRange(leave.fromDate, leave.toDate, monthRange.monthStart, monthRange.monthEnd)
      .forEach((date) => days.add(date));
    return days;
  }, new Set());

  const attendanceCurrentMonth = attendanceRecords.filter(
    (record) => record.date >= monthRange.monthStart && record.date <= monthRange.monthEnd
  );
  const attendanceBeforeMonth = attendanceRecords.filter(
    (record) => record.date >= monthRange.yearStart && record.date <= monthRange.previousMonthEnd
  );

  const presentDays = attendanceCurrentMonth.filter((record) => record.status === "Present").length;
  const lateDaysCurrentMonth = attendanceCurrentMonth.filter((record) => record.status === "Late").length;
  const totalLateDaysBeforeMonth = attendanceBeforeMonth.filter((record) => record.status === "Late").length;
  const latePenaltyBeforeMonth = Math.floor(totalLateDaysBeforeMonth / 3);
  const latePenaltyTillCurrentMonth = Math.floor((totalLateDaysBeforeMonth + lateDaysCurrentMonth) / 3);
  const latePenaltyCurrentMonth = latePenaltyTillCurrentMonth - latePenaltyBeforeMonth;

  const absentDays = attendanceCurrentMonth.filter(
    (record) => record.status === "Absent" && !leaveDatesCurrentMonth.has(record.date)
  ).length;

  const consumedPaidLeavesBeforeMonth = approvedLeaveDaysBeforeMonth + latePenaltyBeforeMonth;
  const remainingPaidLeavesBeforeMonth = Math.max(paidLeaveAllowance - consumedPaidLeavesBeforeMonth, 0);
  const currentMonthPaidLeaveDemand = approvedLeaveDaysCurrentMonth + latePenaltyCurrentMonth;
  const paidLeavesUsedThisMonth = Math.min(remainingPaidLeavesBeforeMonth, currentMonthPaidLeaveDemand);
  const unpaidLeaveDays = Math.max(currentMonthPaidLeaveDemand - remainingPaidLeavesBeforeMonth, 0);
  const remainingPaidLeaves = Math.max(remainingPaidLeavesBeforeMonth - currentMonthPaidLeaveDemand, 0);

  const perDaySalary = monthRange.daysInMonth ? monthlySalary / monthRange.daysInMonth : 0;
  const unpaidLeaveDeductionAmount = Number((perDaySalary * unpaidLeaveDays).toFixed(2));
  const absentDeductionAmount = Number((perDaySalary * absentDays).toFixed(2));
  const deductionDays = absentDays + unpaidLeaveDays;
  const deductionAmount = Number((unpaidLeaveDeductionAmount + absentDeductionAmount).toFixed(2));
  const netSalary = Math.max(Number((monthlySalary - deductionAmount).toFixed(2)), 0);

  return {
    employeeId: employee.employeeId,
    organizationId: employee.organizationId || "",
    employeeName: employee.name,
    department: employee.department,
    designation: employee.designation,
    month: monthRange.label,
    baseSalary: monthlySalary,
    daysInMonth: monthRange.daysInMonth,
    presentDays,
    lateDays: lateDaysCurrentMonth,
    latePenaltyDays: latePenaltyCurrentMonth,
    approvedLeaveDays: approvedLeaveDaysCurrentMonth,
    paidLeavesUsedThisMonth,
    unpaidLeaveDays,
    unpaidLeaveDeductionAmount,
    absentDays,
    absentDeductionAmount,
    remainingPaidLeaves,
    deductionDays,
    deductionAmount,
    netSalary,
    generatedOn: new Date().toISOString().slice(0, 10),
  };
}

async function generate(monthValue) {
  await connectDatabase();

  const employees = await Employee.find({}).sort({ employeeId: 1 }).lean();

  for (const employee of employees) {
    const [attendanceRecords, leaveRecords] = await Promise.all([
      Attendance.find({ employeeId: employee.employeeId }).lean(),
      Leave.find({ employeeId: employee.employeeId, status: "Approved" }).lean(),
    ]);

    const salaryRecord = calculateSalaryRecord(
      employee,
      attendanceRecords,
      leaveRecords.map((leave) => ({
        ...leave,
        daysCount: getLeaveDaysCount(leave),
      })),
      monthValue
    );

    await Salary.findOneAndUpdate(
      {
        organizationId: salaryRecord.organizationId,
        employeeId: salaryRecord.employeeId,
        month: salaryRecord.month,
      },
      salaryRecord,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  }

  console.log(`Salary records generated for ${getMonthRange(monthValue).label}`);
  process.exit(0);
}

const selectedMonth = process.argv[2] || new Date().toISOString().slice(0, 7);

generate(selectedMonth).catch((error) => {
  console.error("Salary generation failed", error.message);
  process.exit(1);
});
