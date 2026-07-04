import { useEffect, useMemo, useState } from "react";
import { get, patch } from "../api";
import { getCurrentUser } from "../auth";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

function formatRupees(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function AdminDashboard() {
  const user = getCurrentUser();
  const organizationId = user.organizationId || "";
  const [dashboard, setDashboard] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const params = new URLSearchParams({
          role: "admin",
          employeeId: user.employeeId,
        });

        if (organizationId) {
          params.set("organizationId", organizationId);
        }

        const response = await get(`/dashboard?${params.toString()}`);
        setDashboard(response);
        setError("");

        if (organizationId) {
          const employeeResponse = await get(`/employees?organizationId=${encodeURIComponent(organizationId)}`);
          setEmployees(employeeResponse.employees || []);
        }
      } catch (requestError) {
        setError(requestError.message);
      }
    }

    loadDashboard();
  }, [organizationId, user.employeeId]);

  const departmentDistribution = useMemo(() => {
    if (dashboard?.departmentSummary?.length) {
      return dashboard.departmentSummary;
    }

    if (!employees.length) {
      return [];
    }

    return Array.from(
      employees.reduce((summary, employee) => {
        const department = employee.department || "Unassigned";
        summary.set(department, (summary.get(department) || 0) + 1);
        return summary;
      }, new Map())
    )
      .map(([department, count]) => ({ department, count }))
      .sort((left, right) => left.department.localeCompare(right.department));
  }, [dashboard?.departmentSummary, employees]);

  const respondToCoverageRequest = async (leaveId, decision) => {
    try {
      await patch(`/leaves/${leaveId}`, {
        action: "coverageDecision",
        actorEmployeeId: user.employeeId,
        decision,
      });

      setMessage(
        decision === "accept"
          ? "You accepted the workload. The leave request moved to final admin approval."
          : "You rejected the workload. The request moved to the next priority person."
      );

      const params = new URLSearchParams({
        role: "admin",
        employeeId: user.employeeId,
      });

      if (organizationId) {
        params.set("organizationId", organizationId);
      }

      const response = await get(`/dashboard?${params.toString()}`);
      setDashboard(response);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="layout">
      <Sidebar />

      <div className="main">
        <Navbar />

        <div className="dashboard-hero">
          <div>
            <h2>Dashboard Overview</h2>
            <p className="muted">Track people, attendance, departments, and pending approvals from one place.</p>
          </div>
          <div className="hero-badge">Admin Control Center</div>
        </div>

        {error && <div className="message error">{error}</div>}
        {message && <div className="message success">{message}</div>}

        <div className="cards">
          <div className="card green">
            <h4>Total Employees</h4>
            <p>{dashboard?.stats.totalEmployees ?? 0}</p>
          </div>

          <div className="card yellow">
            <h4>Total Departments</h4>
            <p>{dashboard?.stats.totalDepartments ?? 0}</p>
          </div>

          <div className="card red">
            <h4>Monthly Pay</h4>
            <p>{formatRupees(dashboard?.stats.monthlyPayroll)}</p>
          </div>

          <div className="card green">
            <h4>Pending Leaves</h4>
            <p>{dashboard?.stats.pendingLeaves ?? 0}</p>
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <h3>Today Attendance Snapshot</h3>
            <div className="mini-stat-grid">
              <div className="mini-stat">
                <span>Present</span>
                <strong>{dashboard?.attendance.present ?? 0}</strong>
              </div>
              <div className="mini-stat">
                <span>Absent</span>
                <strong>{dashboard?.attendance.absent ?? 0}</strong>
              </div>
              <div className="mini-stat">
                <span>Late</span>
                <strong>{dashboard?.attendance.late ?? 0}</strong>
              </div>
            </div>
          </div>

          <div className="summary-card">
            <h3>Department Distribution</h3>
            {departmentDistribution.length ? (
              <div className="stack-list">
                {departmentDistribution.map((item) => (
                  <div className="stack-row" key={item.department}>
                    <span>{item.department}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No department data available.</p>
            )}
          </div>

          <div className="summary-card">
            <h3>Workload Requests Assigned To You</h3>
            {dashboard?.adminCoverageRequests?.length ? (
              <div className="stack-list">
                {dashboard.adminCoverageRequests.map((leave) => (
                  <div className="stack-row wide" key={leave._id || leave.id}>
                    <div>
                      <strong>{leave.employeeName}</strong>
                      <div className="muted">{leave.fromDate} to {leave.toDate}</div>
                    </div>
                    <div className="table-actions">
                      <button className="primary-btn" onClick={() => respondToCoverageRequest(leave.id, "accept")}>
                        Accept
                      </button>
                      <button className="danger-btn" onClick={() => respondToCoverageRequest(leave.id, "reject")}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No workload requests are assigned to you.</p>
            )}
          </div>

          <div className="summary-card">
            <h3>Pending Leave Requests</h3>
            {dashboard?.pendingLeaveRequests?.length ? (
              <div className="stack-list">
                {dashboard.pendingLeaveRequests.map((leave) => (
                  <div className="stack-row wide" key={leave._id || leave.id}>
                    <div>
                      <strong>{leave.employeeName}</strong>
                      <div className="muted">{leave.fromDate} to {leave.toDate}</div>
                    </div>
                    <span className="status-badge status-pending">Pending</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No pending leave requests.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
