import { useCallback, useEffect, useMemo, useState } from "react";
import { get } from "../api";
import { getCurrentUser } from "../auth";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

function formatRupees(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function Salary() {
  const user = getCurrentUser();
  const role = user.role;
  const organizationId = user.organizationId || "";
  const [salaryData, setSalaryData] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchEmployeeId, setSearchEmployeeId] = useState("");
  const [searchDepartment, setSearchDepartment] = useState("");
  const [error, setError] = useState("");

  const loadSalary = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        role,
        employeeId: user.employeeId,
      });

      if (role === "admin" && organizationId) {
        params.set("organizationId", organizationId);
      }
      if (payrollMonth) {
        params.set("month", payrollMonth);
      }

      const response = await get(`/salary?${params.toString()}`);
      setSalaryData(response);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [organizationId, payrollMonth, role, user.employeeId]);

  useEffect(() => {
    loadSalary();
  }, [loadSalary]);

  const salary = salaryData?.salary;
  const filteredRecords = useMemo(() => {
    const records = salaryData?.records || [];
    return records.filter((record) => {
      const matchesEmployeeId = searchEmployeeId
        ? record.employeeId?.toLowerCase().includes(searchEmployeeId.toLowerCase())
        : true;
      const matchesDepartment = searchDepartment
        ? record.department === searchDepartment
        : true;

      return matchesEmployeeId && matchesDepartment;
    });
  }, [salaryData?.records, searchDepartment, searchEmployeeId]);

  return (
    <div className="layout">
      <Sidebar />

      <div className="main">
        <Navbar />

        <h2 className="page-title">Salary</h2>
        {error && <div className="message error">{error}</div>}

        {role === "admin" ? (
          <>
            <div className="cards">
              <div className="card green">
                <h4>Payroll Month</h4>
                <input
                  type="month"
                  value={payrollMonth}
                  onChange={(event) => setPayrollMonth(event.target.value)}
                />
              </div>
              <div className="card yellow">
                <h4>Total Base Salary</h4>
                <p>{formatRupees(salaryData?.totals?.baseSalary)}</p>
              </div>
              <div className="card red">
                <h4>Total Deductions</h4>
                <p>{formatRupees(salaryData?.totals?.deductionAmount)}</p>
              </div>
              <div className="card green">
                <h4>Net Payroll</h4>
                <p>{formatRupees(salaryData?.totals?.netSalary)}</p>
              </div>
            </div>

            <div className="summary-card" style={{ margin: "20px" }}>
              <h3>Search Salary Records</h3>
              <div className="form-grid">
                <input
                  placeholder="Search by Employee ID"
                  value={searchEmployeeId}
                  onChange={(event) => setSearchEmployeeId(event.target.value)}
                />
                <select
                  value={searchDepartment}
                  onChange={(event) => setSearchDepartment(event.target.value)}
                >
                  <option value="">All Departments</option>
                  <option value="IT">IT</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Emp ID</th>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Base Salary</th>
                    <th>Present</th>
                    <th>Late</th>
                    <th>Late Penalty</th>
                    <th>Approved Leave</th>
                    <th>Unpaid Leaves</th>
                    <th>Unpaid Leave Deduction</th>
                    <th>Absent</th>
                    <th>Workload Rejections</th>
                    <th>Workload Penalty</th>
                    <th>Paid Leave Left</th>
                    <th>Deduction</th>
                    <th>Net Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length ? (
                    filteredRecords.map((record) => (
                      <tr key={record.employeeId}>
                        <td>{record.employeeId}</td>
                        <td>{record.employeeName}</td>
                        <td>{record.department}</td>
                        <td>{formatRupees(record.baseSalary)}</td>
                        <td>{record.presentDays}</td>
                        <td>{record.lateDays}</td>
                        <td>{record.latePenaltyDays}</td>
                        <td>{record.approvedLeaveDays}</td>
                        <td>{record.unpaidLeaveDays}</td>
                        <td>{formatRupees(record.unpaidLeaveDeductionAmount)}</td>
                        <td>{record.absentDays}</td>
                        <td>{record.workloadRejectionCount}</td>
                        <td>{formatRupees(record.workloadPenaltyAmount)}</td>
                        <td>{record.remainingPaidLeaves}</td>
                        <td>{formatRupees(record.deductionAmount)}</td>
                        <td>{formatRupees(record.netSalary)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="16">No salary records available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="cards">
              <div className="card green">
                <h4>Salary Month</h4>
                <input
                  type="month"
                  value={payrollMonth}
                  onChange={(event) => setPayrollMonth(event.target.value)}
                />
              </div>
              <div className="card yellow">
                <h4>Base Salary</h4>
                <p>{formatRupees(salary?.baseSalary)}</p>
              </div>
              <div className="card red">
                <h4>Deduction</h4>
                <p>{formatRupees(salary?.deductionAmount)}</p>
              </div>
              <div className="card green">
                <h4>Net Salary</h4>
                <p>{formatRupees(salary?.netSalary)}</p>
              </div>
            </div>

            <div className="summary-grid">
              <div className="summary-card">
                <h3>Attendance Impact</h3>
                <p><strong>Present Days:</strong> {salary?.presentDays ?? 0}</p>
                <p><strong>Late Marks:</strong> {salary?.lateDays ?? 0}</p>
                <p><strong>Late Penalty Days:</strong> {salary?.latePenaltyDays ?? 0}</p>
                <p><strong>Absent Days:</strong> {salary?.absentDays ?? 0}</p>
              </div>

              <div className="summary-card">
                <h3>Leave Impact</h3>
                <p><strong>Approved Leave Days:</strong> {salary?.approvedLeaveDays ?? 0}</p>
                <p><strong>Paid Leaves Used This Month:</strong> {salary?.paidLeavesUsedThisMonth ?? 0}</p>
                <p><strong>Unpaid Leave Days:</strong> {salary?.unpaidLeaveDays ?? 0}</p>
                <p><strong>Unpaid Leave Deduction:</strong> {formatRupees(salary?.unpaidLeaveDeductionAmount)}</p>
                <p><strong>Workload Rejections:</strong> {salary?.workloadRejectionCount ?? 0}</p>
                <p><strong>Workload Penalty:</strong> {formatRupees(salary?.workloadPenaltyAmount)}</p>
                <p><strong>Remaining Paid Leaves:</strong> {salary?.remainingPaidLeaves ?? 0}</p>
              </div>

              <div className="summary-card">
                <h3>Salary Breakdown</h3>
                <p><strong>Days In Month:</strong> {salary?.daysInMonth ?? 0}</p>
                <p><strong>Deduction Days:</strong> {salary?.deductionDays ?? 0}</p>
                <p><strong>Deduction Amount:</strong> {formatRupees(salary?.deductionAmount)}</p>
                <p><strong>Net Salary:</strong> {formatRupees(salary?.netSalary)}</p>
              </div>
            </div>

            <div className="summary-card" style={{ margin: "20px" }}>
              <h3>Salary Rules</h3>
              <p><strong>Rule 1:</strong> Salary starts from the employee's monthly base salary.</p>
              <p><strong>Rule 2:</strong> Every 3 late marks are treated as 1 leave day.</p>
              <p><strong>Rule 3:</strong> Approved leave first uses remaining paid leave balance.</p>
              <p><strong>Rule 4:</strong> If paid leave is exhausted, extra leave days reduce salary.</p>
              <p><strong>Rule 5:</strong> Unapproved absent days reduce salary directly.</p>
              <p><strong>Rule 6:</strong> Every workload rejection adds a warning and a half-day salary deduction.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Salary;
