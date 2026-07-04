require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const connectDatabase = require("./config/db");
const Counter = require("./models/Counter");
const User = require("./models/User");
const Employee = require("./models/Employee");
const Attendance = require("./models/Attendance");
const Leave = require("./models/Leave");
const Performance = require("./models/Performance");
const Salary = require("./models/Salary");

const app = express();
const PORT = process.env.PORT || 5000;
const PASSWORD_HASH_PREFIX = "scrypt";

app.use(express.json());

function sanitizeUser(user) {
  const { password, ...safeUser } = user.toObject ? user.toObject() : user;
  return safeUser;
}

function isPasswordHashed(password = "") {
  return String(password).startsWith(`${PASSWORD_HASH_PREFIX}$`);
}

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

function verifyPassword(storedPassword, suppliedPassword) {
  if (!storedPassword) {
    return Promise.resolve(false);
  }

  if (!isPasswordHashed(storedPassword)) {
    return Promise.resolve(storedPassword === suppliedPassword);
  }

  const [, salt, hash] = storedPassword.split("$");

  return new Promise((resolve, reject) => {
    crypto.scrypt(suppliedPassword, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      const storedBuffer = Buffer.from(hash, "hex");
      const suppliedBuffer = Buffer.from(derivedKey.toString("hex"), "hex");

      if (storedBuffer.length !== suppliedBuffer.length) {
        resolve(false);
        return;
      }

      resolve(crypto.timingSafeEqual(storedBuffer, suppliedBuffer));
    });
  });
}

async function getNextEmployeeId() {
  const counter = await Counter.findOneAndUpdate(
    { name: "employeeId" },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );

  return `EMP${String(counter.value).padStart(3, "0")}`;
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

function calculateRejoiningDate(toDate) {
  const nextDate = new Date(toDate);
  nextDate.setDate(nextDate.getDate() + 1);
  return nextDate.toISOString().slice(0, 10);
}

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

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCoverageCandidates(leave = {}) {
  if (Array.isArray(leave.coverageCandidates) && leave.coverageCandidates.length) {
    return leave.coverageCandidates.map((candidate, index) => ({
      employeeId: candidate.employeeId,
      name: candidate.name,
      priority: Number(candidate.priority || index + 1),
      status: candidate.status || "Pending",
      respondedOn: candidate.respondedOn || "",
      warningIssued: Boolean(candidate.warningIssued),
      penaltyApplied: Boolean(candidate.penaltyApplied),
    }));
  }

  if (leave.coverageEmployeeId) {
    let legacyStatus = "Pending";

    if (leave.status === "Approved") {
      legacyStatus = "Accepted";
    } else if (leave.status === "Rejected") {
      legacyStatus = "Rejected";
    } else if (leave.status === "Pending Admin Approval") {
      legacyStatus = "Accepted";
    }

    return [
      {
        employeeId: leave.coverageEmployeeId,
        name: leave.coverageEmployeeName || leave.coverageEmployeeId,
        priority: 1,
        status: legacyStatus,
        respondedOn: leave.adminActionOn || leave.appliedOn || "",
        warningIssued: false,
        penaltyApplied: false,
      },
    ];
  }

  return [];
}

function getCurrentCoverageCandidate(leave = {}) {
  const coverageCandidates = normalizeCoverageCandidates(leave);

  if (!coverageCandidates.length) {
    return null;
  }

  const currentIndex = Number.isInteger(leave.currentCoverageIndex)
    ? leave.currentCoverageIndex
    : coverageCandidates.findIndex((candidate) => candidate.status === "Pending");

  return coverageCandidates[currentIndex] || coverageCandidates.find((candidate) => candidate.status === "Pending") || null;
}

function buildCoverageSummary(leave = {}) {
  const coverageCandidates = normalizeCoverageCandidates(leave);
  const acceptedCandidate = coverageCandidates.find((candidate) => candidate.status === "Accepted") || null;
  const currentCandidate = getCurrentCoverageCandidate(leave);

  return {
    coverageCandidates,
    acceptedCandidate,
    currentCandidate,
    rejectedCandidates: coverageCandidates.filter((candidate) => candidate.status === "Rejected"),
  };
}

function mapLeaveRecord(leave, employeeNames) {
  const coverageSummary = buildCoverageSummary(leave);

  return {
    ...leave,
    id: leave._id,
    employeeName: employeeNames.get(leave.employeeId) || leave.employeeId,
    coverageEmployeeId:
      leave.coverageEmployeeId ||
      coverageSummary.acceptedCandidate?.employeeId ||
      "",
    coverageEmployeeName:
      leave.coverageEmployeeName ||
      coverageSummary.acceptedCandidate?.name ||
      "",
    currentCoverageEmployeeId:
      leave.currentCoverageEmployeeId ||
      coverageSummary.currentCandidate?.employeeId ||
      "",
    currentCoverageEmployeeName:
      leave.currentCoverageEmployeeName ||
      coverageSummary.currentCandidate?.name ||
      "",
    coverageCandidates: coverageSummary.coverageCandidates,
    workflow: {
      currentCoverageEmployeeId:
        leave.currentCoverageEmployeeId ||
        coverageSummary.currentCandidate?.employeeId ||
        "",
      currentCoverageEmployeeName:
        leave.currentCoverageEmployeeName ||
        coverageSummary.currentCandidate?.name ||
        "",
      acceptedCoverageEmployeeId:
        leave.coverageEmployeeId ||
        coverageSummary.acceptedCandidate?.employeeId ||
        "",
      acceptedCoverageEmployeeName:
        leave.coverageEmployeeName ||
        coverageSummary.acceptedCandidate?.name ||
        "",
      rejectedCount: coverageSummary.rejectedCandidates.length,
      totalCoverageOptions: coverageSummary.coverageCandidates.length,
    },
  };
}

function calculateSalaryRecord(employee, attendanceRecords, leaveRecords, monthValue, allLeaveRecords = []) {
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
  const workloadRejectionCount = allLeaveRecords.reduce((sum, leave) => {
    const monthlyRejections = normalizeCoverageCandidates(leave).filter(
      (candidate) =>
        candidate.employeeId === employee.employeeId &&
        candidate.status === "Rejected" &&
        candidate.penaltyApplied &&
        candidate.respondedOn >= monthRange.monthStart &&
        candidate.respondedOn <= monthRange.monthEnd
    ).length;

    return sum + monthlyRejections;
  }, 0);
  const workloadPenaltyDays = Number((workloadRejectionCount * 0.5).toFixed(1));
  const workloadPenaltyAmount = Number((perDaySalary * workloadPenaltyDays).toFixed(2));
  const deductionDays = absentDays + unpaidLeaveDays + workloadPenaltyDays;
  const deductionAmount = Number(
    (unpaidLeaveDeductionAmount + absentDeductionAmount + workloadPenaltyAmount).toFixed(2)
  );
  const netSalary = Math.max(Number((monthlySalary - deductionAmount).toFixed(2)), 0);

  return {
    employeeId: employee.employeeId,
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
    workloadRejectionCount,
    workloadPenaltyDays,
    workloadPenaltyAmount,
    remainingPaidLeaves,
    deductionDays,
    deductionAmount,
    netSalary,
  };
}

function getOrganizationIdFromEmployeeId(employeeId) {
  return `ORG-${employeeId}`;
}

async function getDefaultEmployeeOrganizationId() {
  const firstAdmin = await User.findOne({ role: "admin" }).sort({ createdAt: 1 }).lean();

  if (!firstAdmin) {
    return "";
  }

  return firstAdmin.organizationId || getOrganizationIdFromEmployeeId(firstAdmin.employeeId);
}

async function persistSalaryRecord(record, organizationId) {
  const payload = {
    ...record,
    organizationId,
    generatedOn: new Date().toISOString().slice(0, 10),
  };

  await Salary.findOneAndUpdate(
    {
      organizationId,
      employeeId: record.employeeId,
      month: record.month,
    },
    payload,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function migrateLegacyOrganizationData() {
  const firstAdmin = await User.findOne({ role: "admin" }).sort({ createdAt: 1 });

  if (!firstAdmin) {
    return;
  }

  const legacyOrganizationId =
    firstAdmin.organizationId || getOrganizationIdFromEmployeeId(firstAdmin.employeeId);

  if (!firstAdmin.organizationId) {
    firstAdmin.organizationId = legacyOrganizationId;
    await firstAdmin.save();
  }

  await Promise.all([
    User.updateMany(
      { role: "admin", $or: [{ organizationId: { $exists: false } }, { organizationId: "" }, { organizationId: null }] },
      { $set: { organizationId: legacyOrganizationId } }
    ),
    Employee.updateMany(
      { $or: [{ organizationId: { $exists: false } }, { organizationId: "" }, { organizationId: null }] },
      { $set: { organizationId: legacyOrganizationId } }
    ),
    User.updateMany(
      { role: "employee", $or: [{ organizationId: { $exists: false } }, { organizationId: "" }, { organizationId: null }] },
      { $set: { organizationId: legacyOrganizationId } }
    ),
    Attendance.updateMany(
      { $or: [{ organizationId: { $exists: false } }, { organizationId: "" }, { organizationId: null }] },
      { $set: { organizationId: legacyOrganizationId } }
    ),
    Leave.updateMany(
      { $or: [{ organizationId: { $exists: false } }, { organizationId: "" }, { organizationId: null }] },
      { $set: { organizationId: legacyOrganizationId } }
    ),
    Performance.updateMany(
      { $or: [{ organizationId: { $exists: false } }, { organizationId: "" }, { organizationId: null }] },
      { $set: { organizationId: legacyOrganizationId } }
    ),
    Salary.updateMany(
      { $or: [{ organizationId: { $exists: false } }, { organizationId: "" }, { organizationId: null }] },
      { $set: { organizationId: legacyOrganizationId } }
    ),
  ]);
}

async function migrateLegacyLeaveWorkflow() {
  const legacyLeaves = await Leave.find({
    $or: [
      { status: "Pending" },
      { coverageCandidates: { $exists: false } },
      { coverageCandidates: { $size: 0 } },
    ],
  }).lean();

  for (const leave of legacyLeaves) {
    const updates = {};
    const hasCoverageCandidates = Array.isArray(leave.coverageCandidates) && leave.coverageCandidates.length > 0;

    if (!hasCoverageCandidates && leave.coverageEmployeeId) {
      updates.coverageCandidates = [
        {
          employeeId: leave.coverageEmployeeId,
          name: leave.coverageEmployeeName || leave.coverageEmployeeId,
          priority: 1,
          status: leave.status === "Approved" ? "Accepted" : leave.status === "Rejected" ? "Rejected" : "Pending",
          respondedOn: leave.status === "Pending" ? "" : (leave.adminActionOn || leave.appliedOn || ""),
          warningIssued: false,
          penaltyApplied: false,
        },
      ];
    }

    if (leave.status === "Pending") {
      updates.status = "Pending Coverage Approval";
    }

    const leaveWithUpdates = {
      ...leave,
      ...updates,
    };

    if (
      (updates.status || leave.status) === "Pending Coverage Approval" &&
      (!leave.currentCoverageEmployeeId || !leave.currentCoverageEmployeeName)
    ) {
      const pendingCandidate = normalizeCoverageCandidates(leaveWithUpdates).find(
        (candidate) => candidate.status === "Pending"
      );

      updates.currentCoverageIndex = pendingCandidate ? Math.max((pendingCandidate.priority || 1) - 1, 0) : 0;
      updates.currentCoverageEmployeeId = pendingCandidate?.employeeId || "";
      updates.currentCoverageEmployeeName = pendingCandidate?.name || "";
    }

    if (
      (updates.status || leave.status) === "Pending Admin Approval" &&
      (!leave.coverageEmployeeId || !leave.coverageEmployeeName)
    ) {
      const acceptedCandidate = normalizeCoverageCandidates(leaveWithUpdates).find(
        (candidate) => candidate.status === "Accepted"
      );

      updates.coverageEmployeeId = acceptedCandidate?.employeeId || leave.coverageEmployeeId || "";
      updates.coverageEmployeeName = acceptedCandidate?.name || leave.coverageEmployeeName || "";
    }

    if (Object.keys(updates).length) {
      await Leave.updateOne({ _id: leave._id }, { $set: updates });
    }
  }
}

async function migratePlaintextPasswords() {
  const usersWithPlaintextPasswords = await User.find({}).select("+password").lean();

  for (const user of usersWithPlaintextPasswords) {
    if (!user.password || isPasswordHashed(user.password)) {
      continue;
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { password: await hashPassword(user.password) } }
    );
  }
}

async function buildEmployeeLeaveMeta(employeeId) {
  const employee = await Employee.findOne({ employeeId }).lean();

  if (!employee) {
    return null;
  }

  const colleagues = await Employee.find({
    organizationId: employee.organizationId || "",
    department: employee.department,
    employeeId: { $ne: employeeId },
    status: "Active",
  })
    .sort({ name: 1 })
    .lean();
  const adminUsers = await User.find({
    organizationId: employee.organizationId || "",
    role: "admin",
    employeeId: { $ne: employeeId },
  })
    .sort({ name: 1 })
    .lean();
  const colleagueOptions = [
    ...colleagues.map((colleague) => ({
      employeeId: colleague.employeeId,
      name: colleague.name,
      source: "employee",
    })),
    ...adminUsers.map((adminUser) => ({
      employeeId: adminUser.employeeId,
      name: adminUser.name,
      source: "admin",
    })),
  ].filter(
    (candidate, index, candidates) =>
      candidates.findIndex((item) => item.employeeId === candidate.employeeId) === index
  );

  const approvedLeaves = await Leave.find({
    employeeId,
    status: "Approved",
  }).lean();

  const totalLeaveAllowance = 24;
  const usedLeaveDays = approvedLeaves.reduce((sum, leave) => sum + getLeaveDaysCount(leave), 0);

  return {
    joiningDate: employee.joinDate,
    totalPaidLeaves: totalLeaveAllowance,
    usedLeaveDays,
    leaveBalance: Math.max(totalLeaveAllowance - usedLeaveDays, 0),
    colleagues: colleagueOptions,
  };
}

app.get("/api/health", async (request, response) => {
  response.json({ status: "ok" });
});

app.post("/api/auth/login", async (request, response) => {
  try {
    const { username, password, role } = request.body;
    const identifier = String(username || "").toLowerCase();

    const candidate = await User.findOne({
      role,
      $or: [
        { username: identifier },
        { email: identifier },
      ],
    }).select("+password").lean();

    if (!candidate || !(await verifyPassword(candidate.password, password))) {
      response.status(401).json({ message: "Invalid credentials for the selected role." });
      return;
    }

    response.json({ user: sanitizeUser(candidate) });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.post("/api/auth/signup", async (request, response) => {
  try {
    const {
      name,
      email,
      password,
      department,
      role,
    } = request.body;

    if (!name || !email || !password || !department || !role) {
      response.status(400).json({ message: "Please fill all signup details." });
      return;
    }

    const normalizedEmail = String(email).toLowerCase();
    const username = normalizedEmail.split("@")[0];
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { username },
      ],
    }).lean();

    if (existingUser) {
      response.status(409).json({ message: "User already exists with this email." });
      return;
    }

    const manager = "System Admin";
    const normalizedRole = role === "admin" ? "admin" : "employee";
    const designation = normalizedRole === "admin" ? "Administrator" : "Employee";
      let employee = await Employee.findOne({ email: normalizedEmail });
      let employeeId = employee?.employeeId;
      let organizationId = employee?.organizationId;

      if (!employee) {
        employeeId = await getNextEmployeeId();
        organizationId =
          normalizedRole === "admin"
            ? getOrganizationIdFromEmployeeId(employeeId)
            : await getDefaultEmployeeOrganizationId();
        employee = await Employee.create({
          employeeId,
          organizationId,
        name,
        email: normalizedEmail,
        contactNumber: "",
        address: "",
        department,
        designation,
        salary: 0,
        joinDate: new Date().toISOString().slice(0, 10),
        status: "Active",
        manager,
      });
      } else {
        organizationId =
          employee.organizationId ||
          (normalizedRole === "admin"
            ? getOrganizationIdFromEmployeeId(employee.employeeId)
            : await getDefaultEmployeeOrganizationId());
      }

    const user = await User.create({
      employeeId,
      organizationId,
      username,
      name: employee.name || name,
      email: normalizedEmail,
      contactNumber: employee.contactNumber || "",
      address: employee.address || "",
      password: await hashPassword(password),
      role: normalizedRole,
      department: employee.department || department,
      designation: employee.designation || designation,
      salary: Number(employee.salary || 0),
      manager: employee.manager || manager,
    });

    const existingPerformance = await Performance.findOne({ employeeId }).lean();

    if (!existingPerformance) {
      await Performance.create({
        employeeId,
        organizationId,
        month: "April 2026",
        rating: "Average",
        review: "Review pending.",
      });
    }

    response.status(201).json({
      message: "Signup completed successfully.",
      user: sanitizeUser(user),
      employee: employee.toObject ? employee.toObject() : employee,
    });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.get("/api/dashboard", async (request, response) => {
  try {
    const { role, employeeId, organizationId } = request.query;

    if (role === "admin") {
      const today = new Date().toISOString().slice(0, 10);
      const [employees, pendingLeaves, todayAttendance, pendingLeaveRequests, adminCoverageCandidates, currentAdminUser] = await Promise.all([
        Employee.find({ organizationId }).sort({ joinDate: -1 }).lean(),
        Leave.countDocuments({
          organizationId,
          status: { $in: ["Pending Coverage Approval", "Pending Admin Approval"] },
        }),
        Attendance.find({ date: today, organizationId }).lean(),
        Leave.find({ status: "Pending Admin Approval", organizationId }).sort({ appliedOn: -1, createdAt: -1 }).limit(5).lean(),
        Leave.find({
          organizationId,
          status: "Pending Coverage Approval",
        })
          .sort({ appliedOn: -1, createdAt: -1 })
          .lean(),
        User.findOne({ employeeId, role: "admin" }).lean(),
      ]);

      const departments = new Set(employees.map((employee) => employee.department));
      const departmentSummary = Array.from(
        employees.reduce((summary, employee) => {
          summary.set(employee.department, (summary.get(employee.department) || 0) + 1);
          return summary;
        }, new Map())
      ).map(([department, count]) => ({ department, count }));
      const employeeNameMap = new Map(employees.map((employee) => [employee.employeeId, employee.name]));

      const adminCoverageRequests = adminCoverageCandidates
        .map((leave) => mapLeaveRecord(leave, employeeNameMap))
        .filter(
          (leave) =>
            leave.currentCoverageEmployeeId === employeeId ||
            leave.currentCoverageEmployeeName === currentAdminUser?.name
        )
        .slice(0, 5);

      response.json({
        stats: {
          totalEmployees: employees.length,
          totalDepartments: departments.size,
          monthlyPayroll: employees.reduce((sum, employee) => sum + Number(employee.salary || 0), 0),
          pendingLeaves,
        },
        attendance: {
          present: todayAttendance.filter((record) => record.status === "Present").length,
          absent: todayAttendance.filter((record) => record.status === "Absent").length,
          late: todayAttendance.filter((record) => record.status === "Late").length,
        },
        recentEmployees: employees.slice(0, 5),
        departmentSummary,
        pendingLeaveRequests: pendingLeaveRequests.map((leave) => ({
          ...mapLeaveRecord(leave, employeeNameMap),
        })),
        adminCoverageRequests,
      });
      return;
    }

    const [employee, attendance, leaves, reviews, leaveMeta] = await Promise.all([
      Employee.findOne({ employeeId }).lean(),
      Attendance.find({ employeeId }).lean(),
      Leave.find({ employeeId }).lean(),
      Performance.find({ employeeId }).sort({ createdAt: -1 }).lean(),
      buildEmployeeLeaveMeta(employeeId),
    ]);
    const sortedAttendance = [...attendance].sort((left, right) => new Date(right.date) - new Date(left.date));
    const sortedLeaves = [...leaves].sort((left, right) => new Date(right.appliedOn) - new Date(left.appliedOn));
    const latestReview = reviews[0] || null;

    response.json({
      employee,
      stats: {
        presentDays: attendance.filter((record) => record.status === "Present").length,
        leaveCount: leaves.length,
        approvedLeaves: leaves.filter((leave) => leave.status === "Approved").length,
        pendingLeaves: leaves.filter((leave) => String(leave.status).startsWith("Pending")).length,
        performanceRating: latestReview?.rating || "Not Reviewed",
      },
      leaveMeta,
      recentAttendance: sortedAttendance.slice(0, 5),
      recentLeaves: sortedLeaves.slice(0, 5).map((leave) =>
        mapLeaveRecord(leave, new Map([[employeeId, employee?.name || employeeId]]))
      ),
      latestReview,
    });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.get("/api/employees", async (request, response) => {
  try {
    const { employeeId, department, organizationId } = request.query;
    const query = {};

    if (organizationId) {
      query.organizationId = organizationId;
    }

    if (employeeId) {
      query.employeeId = { $regex: String(employeeId), $options: "i" };
    }

    if (department) {
      query.department = department;
    }

    const employees = await Employee.find(query).sort({ createdAt: -1 }).lean();
    response.json({ employees });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.post("/api/employees", async (request, response) => {
  try {
    const { name, email, contactNumber, address, department, designation, salary, joinDate, manager, organizationId } = request.body;

    if (!name || !email || !department || !designation || !salary || !joinDate || !organizationId) {
      response.status(400).json({ message: "Please fill all employee details." });
      return;
    }

    const existingEmployee = await Employee.findOne({ email: String(email).toLowerCase() }).lean();

    if (existingEmployee) {
      response.status(409).json({ message: "An employee with this email already exists." });
      return;
    }

    const employeeId = await getNextEmployeeId();

    const employee = await Employee.create({
      employeeId,
      organizationId,
      name,
      email,
      contactNumber: contactNumber || "",
      address: address || "",
      department,
      designation,
      salary: Number(salary),
      joinDate,
      status: "Active",
      manager: manager || "Unassigned",
    });

    response.status(201).json({ employee });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.post("/api/employees/bulk", async (request, response) => {
  try {
    const { employees } = request.body;

    if (!Array.isArray(employees) || !employees.length) {
      response.status(400).json({ message: "Please upload employee rows." });
      return;
    }

    const createdEmployees = [];

    for (const row of employees) {
      const { name, email, contactNumber, address, department, designation, salary, joinDate, manager, organizationId } = row;

      if (!name || !email || !department || !designation || !salary || !joinDate || !organizationId) {
        continue;
      }

      const existingEmployee = await Employee.findOne({ email: String(email).toLowerCase() }).lean();

      if (existingEmployee) {
        continue;
      }

      const employeeId = await getNextEmployeeId();

      const employee = await Employee.create({
        employeeId,
        organizationId,
        name,
        email,
        contactNumber: contactNumber || "",
        address: address || "",
        department,
        designation,
        salary: Number(salary),
        joinDate,
        status: "Active",
        manager: manager || "Unassigned",
      });

      createdEmployees.push(employee);
    }

    response.status(201).json({
      message: `${createdEmployees.length} employee records imported successfully.`,
      employees: createdEmployees,
    });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.put("/api/employees/:employeeId", async (request, response) => {
  try {
    const { employeeId } = request.params;
    const updates = request.body;

    const employee = await Employee.findOneAndUpdate(
      { employeeId },
      {
        name: updates.name,
        email: updates.email,
        contactNumber: updates.contactNumber || "",
        address: updates.address || "",
        department: updates.department,
        designation: updates.designation,
        salary: Number(updates.salary),
        joinDate: updates.joinDate,
        manager: updates.manager || "Unassigned",
        status: updates.status || "Active",
      },
      { new: true }
    ).lean();

    if (!employee) {
      response.status(404).json({ message: "Employee not found." });
      return;
    }

    await User.findOneAndUpdate(
      { employeeId },
      {
        name: updates.name,
        email: updates.email,
        contactNumber: updates.contactNumber || "",
        address: updates.address || "",
        department: updates.department,
        designation: updates.designation,
        salary: Number(updates.salary),
        manager: updates.manager || "Unassigned",
      }
    );

    response.json({ employee });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.delete("/api/employees/:employeeId", async (request, response) => {
  try {
    const { employeeId } = request.params;

    const employee = await Employee.findOneAndDelete({ employeeId }).lean();

    if (!employee) {
      response.status(404).json({ message: "Employee not found." });
      return;
    }

    await Promise.all([
      User.deleteOne({ employeeId }),
      Attendance.deleteMany({ employeeId }),
      Leave.deleteMany({ employeeId }),
      Performance.deleteMany({ employeeId }),
    ]);

    response.json({ message: "Employee deleted successfully." });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.get("/api/attendance", async (request, response) => {
  try {
    const { role, employeeId, date, organizationId } = request.query;
    const selectedDate = date || new Date().toISOString().slice(0, 10);

    if (role === "admin") {
      const [employees, selectedDateAttendance] = await Promise.all([
        Employee.find({ organizationId }).sort({ employeeId: 1 }).lean(),
        Attendance.find({ date: selectedDate, organizationId }).lean(),
      ]);

      const attendanceMap = new Map(
        selectedDateAttendance.map((record) => [record.employeeId, record])
      );

      response.json({
        records: employees.map((employee) => {
          const existingRecord = attendanceMap.get(employee.employeeId);

          return {
            id: existingRecord?._id || employee.employeeId,
            recordId: existingRecord?._id || null,
            employeeId: employee.employeeId,
            employeeName: employee.name,
            date: selectedDate,
            status: existingRecord?.status || "Not Marked",
          };
        }),
      });
      return;
    }

    const records = await Attendance.find({ employeeId }).sort({ date: -1, createdAt: -1 }).lean();
    const today = new Date().toISOString().slice(0, 10);
    const todayRecord = records.find((record) => record.date === today) || null;

    response.json({
      records: records.map((record) => ({
        ...record,
        id: record._id,
      })),
      todayStatus: todayRecord ? todayRecord.status : "Not Marked",
    });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.post("/api/attendance", async (request, response) => {
  try {
    const { employeeId, status } = request.body;
    const today = new Date().toISOString().slice(0, 10);
    const employee = await Employee.findOne({ employeeId }).lean();

    const record = await Attendance.findOneAndUpdate(
      { employeeId, date: today },
      { employeeId, organizationId: employee?.organizationId || "", date: today, status: status || "Present" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    response.json({ message: "Attendance submitted successfully.", record });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.post("/api/attendance/admin", async (request, response) => {
  try {
    const { employeeId, status, date, organizationId } = request.body;
    const selectedDate = date || new Date().toISOString().slice(0, 10);

    const record = await Attendance.findOneAndUpdate(
      { employeeId, date: selectedDate },
      { employeeId, organizationId: organizationId || "", date: selectedDate, status },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    response.json({ message: "Attendance updated successfully.", record });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.patch("/api/attendance/:id", async (request, response) => {
  try {
    const record = await Attendance.findByIdAndUpdate(
      request.params.id,
      { status: request.body.status },
      { new: true }
    ).lean();

    if (!record) {
      response.status(404).json({ message: "Attendance record not found." });
      return;
    }

    response.json({ record: { ...record, id: record._id } });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.get("/api/leaves", async (request, response) => {
  try {
    const { role, employeeId, organizationId } = request.query;
    const query = role === "admin"
      ? { organizationId }
      : {
          $or: [
            { employeeId },
            {
              currentCoverageEmployeeId: employeeId,
              status: "Pending Coverage Approval",
            },
          ],
        };

    const [leaves, employees] = await Promise.all([
      Leave.find(query).sort({ appliedOn: -1, createdAt: -1 }).lean(),
      Employee.find(organizationId ? { organizationId } : {}).lean(),
    ]);

    const employeeNames = new Map(employees.map((employee) => [employee.employeeId, employee.name]));
    const mappedLeaves = leaves.map((leave) => mapLeaveRecord(leave, employeeNames));

    if (role === "employee") {
      const meta = await buildEmployeeLeaveMeta(employeeId);
      const myLeaves = mappedLeaves.filter((leave) => leave.employeeId === employeeId);
      const assignedCoverageRequests = mappedLeaves.filter(
        (leave) =>
          leave.currentCoverageEmployeeId === employeeId &&
          leave.status === "Pending Coverage Approval"
      );
      const workloadWarnings = mappedLeaves
        .flatMap((leave) =>
          (leave.coverageCandidates || [])
            .filter(
              (candidate) =>
                candidate.employeeId === employeeId &&
                candidate.status === "Rejected" &&
                candidate.warningIssued
            )
            .map((candidate) => ({
              leaveId: leave.id,
              employeeName: leave.employeeName,
              fromDate: leave.fromDate,
              toDate: leave.toDate,
              respondedOn: candidate.respondedOn,
              penaltyDays: 0.5,
            }))
        )
        .sort((left, right) => new Date(right.respondedOn || 0) - new Date(left.respondedOn || 0));

      response.json({
        leaves: myLeaves,
        assignedCoverageRequests,
        workloadWarnings,
        meta,
      });
      return;
    }

    response.json({
      leaves: mappedLeaves,
    });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.post("/api/leaves", async (request, response) => {
  try {
    const {
      employeeId,
      fromDate,
      toDate,
      reason,
      coverageEmployeeIds,
      emergencyContact1,
      emergencyContact2,
      address,
    } = request.body;

    if (
      !fromDate ||
      !toDate ||
      !reason ||
      !Array.isArray(coverageEmployeeIds) ||
      coverageEmployeeIds.length !== 3 ||
      !emergencyContact1 ||
      !address
    ) {
      response.status(400).json({ message: "Please complete all leave details." });
      return;
    }

    const employee = await Employee.findOne({ employeeId }).lean();

    if (!employee) {
      response.status(404).json({ message: "Employee not found." });
      return;
    }

    const organizationId = employee.organizationId || "";
    const uniqueCoverageEmployeeIds = [...new Set(coverageEmployeeIds.filter(Boolean))];

    if (uniqueCoverageEmployeeIds.length !== 3 || uniqueCoverageEmployeeIds.includes(employeeId)) {
      response.status(400).json({ message: "Choose 3 different backup employees for workload priority." });
      return;
    }

    const coverageEmployees = await Employee.find({
      organizationId,
      employeeId: { $in: uniqueCoverageEmployeeIds },
      department: employee.department,
      status: "Active",
    }).lean();
    const adminCoverageUsers = await User.find({
      organizationId,
      employeeId: { $in: uniqueCoverageEmployeeIds },
      role: "admin",
    }).lean();
    const allowedCoverageMap = new Map([
      ...coverageEmployees.map((coverageEmployee) => [
        coverageEmployee.employeeId,
        { employeeId: coverageEmployee.employeeId, name: coverageEmployee.name },
      ]),
      ...adminCoverageUsers.map((adminUser) => [
        adminUser.employeeId,
        { employeeId: adminUser.employeeId, name: adminUser.name },
      ]),
    ]);

    if (allowedCoverageMap.size !== 3) {
      response.status(400).json({ message: "Workload can be assigned only to active same-department employees or admins in your organization." });
      return;
    }

    const daysCount = calculateInclusiveDays(fromDate, toDate);

    if (Number.isNaN(daysCount) || daysCount <= 0) {
      response.status(400).json({ message: "Please choose a valid leave date range." });
      return;
    }

    if (daysCount > 4) {
      response.status(400).json({ message: "You cannot apply for more than 4 days of leave at one time." });
      return;
    }

    const meta = await buildEmployeeLeaveMeta(employeeId);

    if (meta && daysCount > meta.leaveBalance) {
      response.status(400).json({ message: "Leave balance is not enough for this request." });
      return;
    }

    const prioritizedCoverageCandidates = uniqueCoverageEmployeeIds.map((candidateEmployeeId, index) => ({
      employeeId: candidateEmployeeId,
      name: allowedCoverageMap.get(candidateEmployeeId)?.name || candidateEmployeeId,
      priority: index + 1,
      status: "Pending",
      respondedOn: "",
      warningIssued: false,
      penaltyApplied: false,
    }));
    const firstCoverageCandidate = prioritizedCoverageCandidates[0];

    await Leave.create({
      organizationId,
      employeeId,
      fromDate,
      toDate,
      reason,
      daysCount,
      joinDate: employee.joinDate,
      rejoiningDate: calculateRejoiningDate(toDate),
      coverageEmployeeId: "",
      coverageEmployeeName: "",
      coverageCandidates: prioritizedCoverageCandidates,
      currentCoverageIndex: 0,
      currentCoverageEmployeeId: firstCoverageCandidate.employeeId,
      currentCoverageEmployeeName: firstCoverageCandidate.name,
      emergencyContact1,
      emergencyContact2: emergencyContact2 || "",
      address,
      status: "Pending Coverage Approval",
      appliedOn: getTodayString(),
    });

    response.status(201).json({
      message: `Leave request submitted. It is now waiting for workload acceptance from ${firstCoverageCandidate.name}.`,
    });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.patch("/api/leaves/:id", async (request, response) => {
  try {
    const { action, actorEmployeeId, decision, status } = request.body;
    const leave = await Leave.findById(request.params.id);

    if (!leave) {
      response.status(404).json({ message: "Leave request not found." });
      return;
    }

    if (action === "coverageDecision") {
      if (leave.status !== "Pending Coverage Approval") {
        response.status(400).json({ message: "This leave request is not waiting for workload approval." });
        return;
      }

      const currentCoverageCandidate = getCurrentCoverageCandidate(leave);

      if (!currentCoverageCandidate || currentCoverageCandidate.employeeId !== actorEmployeeId) {
        response.status(403).json({ message: "Only the current workload approver can respond to this request." });
        return;
      }

      const coverageCandidates = normalizeCoverageCandidates(leave);
      const currentCoverageIndex = coverageCandidates.findIndex(
        (candidate) => candidate.employeeId === actorEmployeeId && candidate.status === "Pending"
      );

      if (currentCoverageIndex === -1) {
        response.status(400).json({ message: "This workload request was already handled." });
        return;
      }

      if (decision === "accept") {
        coverageCandidates[currentCoverageIndex] = {
          ...coverageCandidates[currentCoverageIndex],
          status: "Accepted",
          respondedOn: getTodayString(),
        };
        coverageCandidates.forEach((candidate, index) => {
          if (index > currentCoverageIndex && candidate.status === "Pending") {
            coverageCandidates[index] = {
              ...candidate,
              status: "Skipped",
            };
          }
        });

        leave.coverageCandidates = coverageCandidates;
        leave.currentCoverageIndex = currentCoverageIndex;
        leave.currentCoverageEmployeeId = "";
        leave.currentCoverageEmployeeName = "";
        leave.coverageEmployeeId = coverageCandidates[currentCoverageIndex].employeeId;
        leave.coverageEmployeeName = coverageCandidates[currentCoverageIndex].name;
        leave.status = "Pending Admin Approval";
        await leave.save();
      } else if (decision === "reject") {
        coverageCandidates[currentCoverageIndex] = {
          ...coverageCandidates[currentCoverageIndex],
          status: "Rejected",
          respondedOn: getTodayString(),
          warningIssued: true,
          penaltyApplied: true,
        };

        const nextCoverageIndex = coverageCandidates.findIndex(
          (candidate, index) => index > currentCoverageIndex && candidate.status === "Pending"
        );

        leave.coverageCandidates = coverageCandidates;

        if (nextCoverageIndex === -1) {
          leave.currentCoverageIndex = coverageCandidates.length;
          leave.currentCoverageEmployeeId = "";
          leave.currentCoverageEmployeeName = "";
          leave.coverageEmployeeId = "";
          leave.coverageEmployeeName = "";
          leave.status = "Pending Admin Approval";
        } else {
          leave.currentCoverageIndex = nextCoverageIndex;
          leave.currentCoverageEmployeeId = coverageCandidates[nextCoverageIndex].employeeId;
          leave.currentCoverageEmployeeName = coverageCandidates[nextCoverageIndex].name;
          leave.status = "Pending Coverage Approval";
        }

        await leave.save();
      } else {
        response.status(400).json({ message: "Please choose a valid workload decision." });
        return;
      }
    } else {
      if (!["Approved", "Rejected"].includes(status)) {
        response.status(400).json({ message: "Please choose a valid leave status." });
        return;
      }

      if (leave.status !== "Pending Admin Approval" && status === "Approved") {
        response.status(400).json({ message: "Admin can approve only after workload is accepted." });
        return;
      }

      leave.status = status;
      leave.adminActionOn = getTodayString();
      await leave.save();
    }

    const employeeNames = new Map(
      (await Employee.find({ organizationId: leave.organizationId || "" }).lean()).map((employee) => [
        employee.employeeId,
        employee.name,
      ])
    );

    response.json({ leave: mapLeaveRecord(leave.toObject(), employeeNames) });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.get("/api/performance", async (request, response) => {
  try {
    const { role, employeeId, organizationId } = request.query;
    const query = role === "admin" ? { organizationId } : { employeeId };

    const [reviews, employees] = await Promise.all([
      Performance.find(query).sort({ createdAt: -1 }).lean(),
      Employee.find().lean(),
    ]);

    const employeeNames = new Map(employees.map((employee) => [employee.employeeId, employee.name]));

    response.json({
      reviews: reviews.map((review) => ({
        ...review,
        id: review._id,
        employeeName: employeeNames.get(review.employeeId) || review.employeeId,
      })),
    });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.get("/api/salary", async (request, response) => {
  try {
    const { role, employeeId, organizationId, month } = request.query;

    if (role === "admin") {
      const employees = await Employee.find({ organizationId }).sort({ employeeId: 1 }).lean();
      const employeeIds = employees.map((employee) => employee.employeeId);
      const [attendanceRecords, leaveRecords] = await Promise.all([
        Attendance.find({ organizationId }).lean(),
        Leave.find({ organizationId }).lean(),
      ]);

      const salaryRecords = employees.map((employee) =>
        calculateSalaryRecord(
          employee,
          attendanceRecords.filter((record) => record.employeeId === employee.employeeId),
          leaveRecords.filter((leave) => leave.employeeId === employee.employeeId),
          month,
          leaveRecords
        )
      );

      await Promise.all(
        salaryRecords.map((record) => persistSalaryRecord(record, organizationId))
      );

      response.json({
        month: getMonthRange(month).label,
        records: salaryRecords,
        totals: {
          employeeCount: employeeIds.length,
          baseSalary: salaryRecords.reduce((sum, record) => sum + record.baseSalary, 0),
          deductionAmount: Number(salaryRecords.reduce((sum, record) => sum + record.deductionAmount, 0).toFixed(2)),
          netSalary: Number(salaryRecords.reduce((sum, record) => sum + record.netSalary, 0).toFixed(2)),
        },
      });
      return;
    }

    const employee = await Employee.findOne({ employeeId }).lean();

    if (!employee) {
      response.status(404).json({ message: "Employee not found." });
      return;
    }

    const [attendanceRecords, leaveRecords] = await Promise.all([
      Attendance.find({ employeeId }).lean(),
      Leave.find({ organizationId: employee.organizationId || "" }).lean(),
    ]);

    const salaryRecord = calculateSalaryRecord(
      employee,
      attendanceRecords,
      leaveRecords.filter((leave) => leave.employeeId === employeeId),
      month,
      leaveRecords
    );
    await persistSalaryRecord(salaryRecord, employee.organizationId || "");

    response.json({
      month: getMonthRange(month).label,
      salary: salaryRecord,
    });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.patch("/api/performance/:employeeId", async (request, response) => {
  try {
    const review = await Performance.findOne({ employeeId: request.params.employeeId }).sort({ createdAt: -1 });

    if (!review) {
      response.status(404).json({ message: "Performance review not found." });
      return;
    }

    review.rating = request.body.rating || review.rating;
    review.review = request.body.review || review.review;
    await review.save();

    response.json({ review });
  } catch (error) {
    response.status(500).json({ message: error.message || "Internal server error." });
  }
});

app.use((request, response) => {
  response.status(404).json({ message: "Route not found." });
});

connectDatabase()
  .then(() => {
    migrateLegacyOrganizationData().then(() => {
      migrateLegacyLeaveWorkflow().then(() => {
        migratePlaintextPasswords().then(() => {
          app.listen(PORT, () => {
            console.log(`Employee management backend running on http://localhost:${PORT}`);
          });
        });
      });
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error.message);
    process.exit(1);
  });
