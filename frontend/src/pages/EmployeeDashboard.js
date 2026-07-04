import { useEffect, useState } from "react";
import { get } from "../api";
import { getCurrentUser } from "../auth";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

function formatRupees(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function EmployeeDashboard() {
  const user = getCurrentUser();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await get(`/dashboard?role=employee&employeeId=${user.employeeId}`);
        setDashboard(response);
      } catch (requestError) {
        setError(requestError.message);
      }
    }

    loadDashboard();
  }, [user.employeeId]);

  return (
    <div className="layout">
      <Sidebar />

      <div className="main">
        <Navbar />

        <div className="dashboard-hero">
          <div>
            <h2>Employee Dashboard</h2>
            <p className="muted">See your work profile, leave position, attendance history, and latest review in one overview.</p>
          </div>
          <div className="hero-badge">My Workspace</div>
        </div>

        {error && <div className="message error">{error}</div>}

        <div className="cards">
          <div className="card green">
            <h4>Attendance</h4>
            <p>{dashboard?.stats.presentDays ?? 0}</p>
          </div>

          <div className="card yellow">
            <h4>Leaves</h4>
            <p>{dashboard?.stats.leaveCount ?? 0}</p>
          </div>

          <div className="card red">
            <h4>Performance</h4>
            <p>{dashboard?.stats.performanceRating ?? "NA"}</p>
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <h3>Profile</h3>
            <p><strong>Employee ID:</strong> {dashboard?.employee?.employeeId}</p>
            <p><strong>Department:</strong> {dashboard?.employee?.department}</p>
            <p><strong>Designation:</strong> {dashboard?.employee?.designation}</p>
            <p><strong>Joining Date:</strong> {dashboard?.employee?.joinDate}</p>
            <p><strong>Contact Number:</strong> {dashboard?.employee?.contactNumber || "NA"}</p>
          </div>

          <div className="summary-card">
            <h3>Leave Balance</h3>
            <p><strong>Approved:</strong> {dashboard?.stats.approvedLeaves ?? 0}</p>
            <p><strong>Pending:</strong> {dashboard?.stats.pendingLeaves ?? 0}</p>
            <p><strong>Total Paid Leaves:</strong> {dashboard?.leaveMeta?.totalPaidLeaves ?? 24}</p>
            <p><strong>Remaining Leave Balance:</strong> {dashboard?.leaveMeta?.leaveBalance ?? 24}</p>
            <p><strong>Salary:</strong> {formatRupees(dashboard?.employee?.salary)}</p>
          </div>

          <div className="summary-card">
            <h3>Recent Attendance</h3>
            {dashboard?.recentAttendance?.length ? (
              <div className="stack-list">
                {dashboard.recentAttendance.map((record) => (
                  <div className="stack-row" key={record._id || record.id}>
                    <span>{record.date}</span>
                    <span className={`status-badge status-${record.status.toLowerCase()}`}>{record.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No attendance records yet.</p>
            )}
          </div>

          <div className="summary-card">
            <h3>Recent Leave Requests</h3>
            {dashboard?.recentLeaves?.length ? (
              <div className="stack-list">
                {dashboard.recentLeaves.map((leave) => (
                  <div className="stack-row wide" key={leave._id || leave.id}>
                    <div>
                      <strong>{leave.fromDate} to {leave.toDate}</strong>
                      <div className="muted">{leave.reason}</div>
                    </div>
                    <span className={`status-badge status-${leave.status.toLowerCase()}`}>{leave.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No leave records yet.</p>
            )}
          </div>

          <div className="summary-card">
            <h3>Latest Performance Review</h3>
            {dashboard?.latestReview ? (
              <>
                <p><strong>Month:</strong> {dashboard.latestReview.month}</p>
                <p><strong>Rating:</strong> {dashboard.latestReview.rating}</p>
                <p className="muted">{dashboard.latestReview.review}</p>
              </>
            ) : (
              <p className="muted">No review available yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDashboard;
