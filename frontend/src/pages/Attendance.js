import React, { useCallback, useEffect, useMemo, useState } from "react";
import { get, post } from "../api";
import { getCurrentUser } from "../auth";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

function Attendance() {
  const user = getCurrentUser();
  const role = user.role;
  const organizationId = user.organizationId || "";
  const today = new Date().toISOString().slice(0, 10);
  const [attendance, setAttendance] = useState([]);
  const [todayStatus, setTodayStatus] = useState("Not Marked");
  const [selectedDate, setSelectedDate] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAttendance = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        role,
        employeeId: user.employeeId,
      });

      if (role === "admin") {
        params.set("date", selectedDate || today);
        if (organizationId) {
          params.set("organizationId", organizationId);
        }
      }

      const response = await get(`/attendance?${params.toString()}`);
      setAttendance(response.records);

      if (role === "employee") {
        setTodayStatus(response.todayStatus || "Not Marked");
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [organizationId, role, selectedDate, today, user.employeeId]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const filteredAttendance = useMemo(() => {
    if (role === "admin") {
      return attendance;
    }

    if (!selectedDate) {
      return attendance;
    }

    return attendance.filter((record) => record.date === selectedDate);
  }, [attendance, role, selectedDate]);

  const selectedDateStatus = useMemo(() => {
    if (!selectedDate) {
      return null;
    }

    return attendance.find((record) => record.date === selectedDate)?.status || "Not Marked";
  }, [attendance, selectedDate]);

  const updateAdminAttendance = async (employeeId, status) => {
    setMessage("");
    setError("");

    try {
      await post("/attendance/admin", {
        employeeId,
        status,
        date: selectedDate || today,
        organizationId,
      });
      setMessage("Attendance updated successfully.");
      loadAttendance();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="layout">
      <Sidebar />

      <div className="main">
        <Navbar />

        <h2 className="page-title">Attendance</h2>

        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}

        {role === "admin" ? (
          <>
            <div className="form-container">
              <h3>Filter Attendance By Date</h3>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Employee Name</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAttendance.length ? (
                    filteredAttendance.map((record) => (
                      <tr key={`${record.employeeId}-${record.date}`}>
                        <td>{record.employeeId}</td>
                        <td>{record.employeeName}</td>
                        <td>{record.date}</td>
                        <td>
                          <span className={`status-badge ${record.status === "Not Marked" ? "status-pending" : `status-${record.status.toLowerCase()}`}`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="table-actions">
                          <button className="primary-btn" onClick={() => updateAdminAttendance(record.employeeId, "Present")}>Present</button>
                          <button className="secondary-btn" onClick={() => updateAdminAttendance(record.employeeId, "Late")}>Late</button>
                          <button className="danger-btn" onClick={() => updateAdminAttendance(record.employeeId, "Absent")}>Absent</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5">No attendance records found for the selected date.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="form-container">
              <h3>Today Attendance</h3>
              <p>
                Current status:{" "}
                <span className={`status-badge ${todayStatus === "Not Marked" ? "status-pending" : `status-${todayStatus.toLowerCase()}`}`}>
                  {todayStatus}
                </span>
              </p>
              <p className="muted">Attendance is managed by admin. You can only view your status here.</p>
            </div>

            <div className="form-container">
              <h3>Check Attendance By Date</h3>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              {selectedDate && (
                <p>
                  Selected date status:{" "}
                  <span className={`status-badge ${selectedDateStatus === "Not Marked" ? "status-pending" : `status-${selectedDateStatus.toLowerCase()}`}`}>
                    {selectedDateStatus}
                  </span>
                </p>
              )}
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAttendance.length ? (
                    filteredAttendance.map((record) => (
                      <tr key={record.id}>
                        <td>{record.date}</td>
                        <td>
                          <span className={`status-badge status-${record.status.toLowerCase()}`}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2">No attendance record found for the selected date.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Attendance;
