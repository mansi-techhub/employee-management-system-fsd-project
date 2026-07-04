import React, { useCallback, useEffect, useMemo, useState } from "react";
import { get, patch, post } from "../api";
import { getCurrentUser } from "../auth";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

const EMPTY_PRIORITY_SELECTIONS = ["", "", ""];

function Leave() {
  const user = getCurrentUser();
  const role = user.role;
  const organizationId = user.organizationId || "";
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [assignedCoverageRequests, setAssignedCoverageRequests] = useState([]);
  const [workloadWarnings, setWorkloadWarnings] = useState([]);
  const [leaveMeta, setLeaveMeta] = useState({
    joiningDate: "",
    totalPaidLeaves: 24,
    usedLeaveDays: 0,
    leaveBalance: 0,
    colleagues: [],
  });
  const [filterDate, setFilterDate] = useState("");
  const [leaveForm, setLeaveForm] = useState({
    fromDate: "",
    toDate: "",
    reason: "",
    coverageEmployeeIds: EMPTY_PRIORITY_SELECTIONS,
    emergencyContact1: "",
    emergencyContact2: "",
    address: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isAdminCoverageAssignee = useCallback(
    (leave) =>
      leave.currentCoverageEmployeeId === user.employeeId ||
      leave.currentCoverageEmployeeName === user.name,
    [user.employeeId, user.name]
  );

  const getLegacyDaysCount = useCallback((leave) => {
    if (leave.daysCount) {
      return leave.daysCount;
    }

    if (!leave.fromDate || !leave.toDate) {
      return "NA";
    }

    const from = new Date(leave.fromDate);
    const to = new Date(leave.toDate);
    const millisecondsInDay = 24 * 60 * 60 * 1000;
    const days = Math.floor((to - from) / millisecondsInDay) + 1;

    return days > 0 ? days : "NA";
  }, []);

  const getLegacyRejoiningDate = useCallback((leave) => {
    if (leave.rejoiningDate) {
      return leave.rejoiningDate;
    }

    if (!leave.toDate) {
      return "NA";
    }

    const nextDate = new Date(leave.toDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate.toISOString().slice(0, 10);
  }, []);

  const normalizeLeaveMeta = useCallback((meta, joiningDateFallback = "") => {
    const totalPaidLeaves = Number(meta?.totalPaidLeaves ?? 24);
    const usedLeaveDays = Number(meta?.usedLeaveDays ?? 0);
    const rawLeaveBalance = meta?.leaveBalance;
    const computedLeaveBalance = Math.max(totalPaidLeaves - usedLeaveDays, 0);
    const leaveBalance =
      rawLeaveBalance === undefined || rawLeaveBalance === null || Number(rawLeaveBalance) < 0
        ? computedLeaveBalance
        : Math.min(Number(rawLeaveBalance), totalPaidLeaves);

    return {
      totalPaidLeaves,
      usedLeaveDays,
      leaveBalance:
        leaveBalance === 0 && computedLeaveBalance > 0 ? computedLeaveBalance : leaveBalance,
      colleagues: meta?.colleagues ?? [],
      joiningDate: meta?.joiningDate || joiningDateFallback || "",
    };
  }, []);

  const loadLeaves = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        role,
        employeeId: user.employeeId,
      });

      if (organizationId) {
        params.set("organizationId", organizationId);
      }

      const response = await get(`/leaves?${params.toString()}`);
      setLeaveRequests(response.leaves || []);

      if (role === "employee") {
        setAssignedCoverageRequests(response.assignedCoverageRequests || []);
        setWorkloadWarnings(response.workloadWarnings || []);

        if (response.meta) {
          let resolvedMeta = response.meta;

          if (!response.meta.joiningDate) {
            const dashboardResponse = await get(`/dashboard?role=employee&employeeId=${user.employeeId}`);
            resolvedMeta = normalizeLeaveMeta(response.meta, dashboardResponse.employee?.joinDate || "");
          }

          const normalizedMeta = normalizeLeaveMeta(resolvedMeta);
          setLeaveMeta(normalizedMeta);
          setLeaveForm((currentForm) => ({
            ...currentForm,
            coverageEmployeeIds:
              currentForm.coverageEmployeeIds.some(Boolean)
                ? currentForm.coverageEmployeeIds
                : normalizedMeta.colleagues.slice(0, 3).map((colleague) => colleague.employeeId).concat(["", "", ""]).slice(0, 3),
          }));
        }
      }

      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [normalizeLeaveMeta, organizationId, role, user.employeeId]);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  const selectedDays = useMemo(() => {
    if (!leaveForm.fromDate || !leaveForm.toDate) {
      return 0;
    }

    const from = new Date(leaveForm.fromDate);
    const to = new Date(leaveForm.toDate);
    const millisecondsInDay = 24 * 60 * 60 * 1000;
    const days = Math.floor((to - from) / millisecondsInDay) + 1;

    return days > 0 ? days : 0;
  }, [leaveForm.fromDate, leaveForm.toDate]);

  const maxToDate = useMemo(() => {
    if (!leaveForm.fromDate) {
      return "";
    }

    const maxDate = new Date(leaveForm.fromDate);
    maxDate.setDate(maxDate.getDate() + 3);
    return maxDate.toISOString().slice(0, 10);
  }, [leaveForm.fromDate]);

  const rejoiningDate = useMemo(() => {
    if (!leaveForm.toDate) {
      return "";
    }

    const nextDate = new Date(leaveForm.toDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate.toISOString().slice(0, 10);
  }, [leaveForm.toDate]);

  const filteredLeaves = useMemo(() => {
    if (!filterDate) {
      return leaveRequests;
    }

    return leaveRequests.filter(
      (leave) => leave.fromDate <= filterDate && leave.toDate >= filterDate
    );
  }, [filterDate, leaveRequests]);

  const priorityNamesPreview = useMemo(
    () =>
      leaveForm.coverageEmployeeIds
        .map((employeeId) => leaveMeta.colleagues.find((colleague) => colleague.employeeId === employeeId)?.name)
        .filter(Boolean),
    [leaveForm.coverageEmployeeIds, leaveMeta.colleagues]
  );

  useEffect(() => {
    if (!leaveForm.fromDate || !leaveForm.toDate || !maxToDate) {
      return;
    }

    if (leaveForm.toDate < leaveForm.fromDate || leaveForm.toDate > maxToDate) {
      setLeaveForm((currentForm) => ({
        ...currentForm,
        toDate: currentForm.fromDate,
      }));
    }
  }, [leaveForm.fromDate, leaveForm.toDate, maxToDate]);

  const updatePriorityEmployee = (index, employeeId) => {
    setLeaveForm((currentForm) => {
      const nextCoverageEmployeeIds = [...currentForm.coverageEmployeeIds];
      nextCoverageEmployeeIds[index] = employeeId;

      return {
        ...currentForm,
        coverageEmployeeIds: nextCoverageEmployeeIds,
      };
    });
  };

  const updateLeaveStatus = async (leaveId, status) => {
    setMessage("");
    setError("");

    try {
      await patch(`/leaves/${leaveId}`, { status });
      setMessage(`Leave request ${status.toLowerCase()} successfully.`);
      loadLeaves();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const respondToCoverageRequest = async (leaveId, decision) => {
    setMessage("");
    setError("");

    if (decision === "reject") {
      const confirmed = window.confirm(
        "If you reject this workload request, a warning will be recorded and a half-day salary will be cut. Do you want to continue?"
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      const response = await patch(`/leaves/${leaveId}`, {
        action: "coverageDecision",
        actorEmployeeId: user.employeeId,
        decision,
      });

      if (decision === "accept") {
        setMessage("You accepted the workload. The leave request is now waiting for admin approval.");
      } else if (response.leave?.status === "Pending Admin Approval") {
        setMessage("You rejected the workload. A half-day salary warning was recorded and the request has now moved to admin with the full backup response history.");
      } else {
        setMessage("You rejected the workload. A half-day salary warning has been recorded and the request moved to the next priority employee.");
      }

      loadLeaves();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const applyLeave = async () => {
    setMessage("");
    setError("");

    const uniqueCoverageEmployeeIds = [...new Set(leaveForm.coverageEmployeeIds.filter(Boolean))];

    if (selectedDays < 1 || selectedDays > 4) {
      setError("Please select leave for 1 to 4 days only.");
      return;
    }

    if (selectedDays > leaveMeta.leaveBalance) {
      setError("Selected leave days exceed your remaining leave balance.");
      return;
    }

    if (uniqueCoverageEmployeeIds.length !== 3) {
      setError("Please choose 3 different employees in priority order to handle your workload.");
      return;
    }

    try {
      await post("/leaves", {
        employeeId: user.employeeId,
        ...leaveForm,
        coverageEmployeeIds: uniqueCoverageEmployeeIds,
      });
      setMessage("Leave request submitted with 3 backup priorities.");
      setLeaveForm({
        fromDate: "",
        toDate: "",
        reason: "",
        coverageEmployeeIds: leaveMeta.colleagues.slice(0, 3).map((colleague) => colleague.employeeId).concat(["", "", ""]).slice(0, 3),
        emergencyContact1: "",
        emergencyContact2: "",
        address: "",
      });
      loadLeaves();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const renderCoveragePriority = (leave) => {
    if (!leave.coverageCandidates?.length) {
      return leave.coverageEmployeeName || "Not assigned";
    }

    return leave.coverageCandidates.map((candidate) => (
      <div key={`${leave.id}-${candidate.employeeId}`}>
        {candidate.priority}. {candidate.name} ({candidate.status})
      </div>
    ));
  };

  return (
    <div className="layout">
      <Sidebar />

      <div className="main">
        <Navbar />

        <h2 className="page-title">Leave Management</h2>

        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}

        {role === "admin" ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Period</th>
                  <th>Days</th>
                  <th>Rejoining Date</th>
                  <th>Coverage Priority</th>
                  <th>Current Step</th>
                  <th>Emergency Contacts</th>
                  <th>Address</th>
                  <th>Leave Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {leaveRequests.map((leave) => (
                  <tr key={leave.id}>
                    <td>{leave.employeeName}</td>
                    <td>{leave.fromDate} to {leave.toDate}</td>
                    <td>{getLegacyDaysCount(leave)}</td>
                    <td>{getLegacyRejoiningDate(leave)}</td>
                    <td>{renderCoveragePriority(leave)}</td>
                    <td>
                      {leave.status === "Pending Coverage Approval"
                        ? `Waiting for ${leave.currentCoverageEmployeeName || "coverage employee"}`
                        : leave.status === "Pending Admin Approval"
                          ? leave.coverageEmployeeName
                            ? `Accepted by ${leave.coverageEmployeeName}`
                            : "Sent to admin after backup responses"
                          : leave.coverageEmployeeName || "Completed"}
                    </td>
                    <td>
                      {leave.emergencyContact1
                        ? `${leave.emergencyContact1}${leave.emergencyContact2 ? `, ${leave.emergencyContact2}` : ""}`
                        : "Not provided"}
                    </td>
                    <td>{leave.address || "Not provided"}</td>
                    <td>{leave.reason}</td>
                    <td>
                      <span className={`status-badge status-${leave.status.toLowerCase().replace(/\s+/g, "-")}`}>
                        {leave.status}
                      </span>
                    </td>
                    <td className="table-actions">
                      {leave.status === "Pending Coverage Approval" &&
                      isAdminCoverageAssignee(leave) ? (
                        <>
                          <button
                            className="primary-btn"
                            onClick={() => respondToCoverageRequest(leave.id, "accept")}
                          >
                            Accept Workload
                          </button>
                          <button
                            className="danger-btn"
                            onClick={() => respondToCoverageRequest(leave.id, "reject")}
                          >
                            Reject Workload
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="primary-btn"
                            onClick={() => updateLeaveStatus(leave.id, "Approved")}
                            disabled={leave.status !== "Pending Admin Approval"}
                          >
                            Approve
                          </button>
                          <button
                            className="danger-btn"
                            onClick={() => updateLeaveStatus(leave.id, "Rejected")}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="cards">
              <div className="card green">
                <h4>Total Paid Leaves</h4>
                <p>{leaveMeta.totalPaidLeaves}</p>
              </div>
              <div className="card yellow">
                <h4>Remaining Leave Balance</h4>
                <p>{leaveMeta.leaveBalance}</p>
              </div>
              <div className="card red">
                <h4>Workload Requests Waiting</h4>
                <p>{assignedCoverageRequests.length}</p>
              </div>
              <div className="card green">
                <h4>Warning Count</h4>
                <p>{workloadWarnings.length}</p>
              </div>
            </div>

            {assignedCoverageRequests.length ? (
              <div className="table-container">
                <h3 style={{ padding: "16px 16px 0" }}>Workload Requests Waiting For Your Reply</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Employee On Leave</th>
                      <th>Period</th>
                      <th>Reason</th>
                      <th>Priority</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedCoverageRequests.map((leave) => (
                      <tr key={leave.id}>
                        <td>{leave.employeeName}</td>
                        <td>{leave.fromDate} to {leave.toDate}</td>
                        <td>{leave.reason}</td>
                        <td>
                          {leave.coverageCandidates.find(
                            (candidate) => candidate.employeeId === user.employeeId
                          )?.priority || "NA"}
                        </td>
                        <td className="table-actions">
                          <button className="primary-btn" onClick={() => respondToCoverageRequest(leave.id, "accept")}>
                            Accept Workload
                          </button>
                          <button className="danger-btn" onClick={() => respondToCoverageRequest(leave.id, "reject")}>
                            Reject Workload
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {workloadWarnings.length ? (
              <div className="summary-card" style={{ margin: "20px" }}>
                <h3>Warning History</h3>
                {workloadWarnings.map((warning) => (
                  <p key={`${warning.leaveId}-${warning.respondedOn}`}>
                    {warning.respondedOn || "Recent"}: You rejected workload for {warning.employeeName}
                    {" "}({warning.fromDate} to {warning.toDate}). A half-day salary deduction rule will apply.
                  </p>
                ))}
              </div>
            ) : null}

            <div className="form-container" style={{ width: "auto", maxWidth: "860px" }}>
              <h3>Apply Leave</h3>

              <div className="form-grid">
                <div>
                  <label>From Date</label>
                  <input
                    type="date"
                    value={leaveForm.fromDate}
                    onChange={(e) =>
                      setLeaveForm((currentForm) => ({
                        ...currentForm,
                        fromDate: e.target.value,
                        toDate:
                          currentForm.toDate && currentForm.toDate < e.target.value
                            ? e.target.value
                            : currentForm.toDate,
                      }))
                    }
                  />
                </div>
                <div>
                  <label>To Date</label>
                  <input
                    type="date"
                    min={leaveForm.fromDate || undefined}
                    max={maxToDate || undefined}
                    value={leaveForm.toDate}
                    onChange={(e) => setLeaveForm((currentForm) => ({ ...currentForm, toDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Rejoining Date</label>
                  <input type="text" value={rejoiningDate || "NA"} readOnly />
                </div>
                <div>
                  <label>Selected Leave Days</label>
                  <input type="text" value={selectedDays ? `${selectedDays} day(s)` : ""} readOnly placeholder="Leave Days" />
                </div>
                {[0, 1, 2].map((priorityIndex) => (
                  <div key={`priority-${priorityIndex}`}>
                    <label>{`Priority ${priorityIndex + 1} Workload Backup`}</label>
                    <select
                      value={leaveForm.coverageEmployeeIds[priorityIndex] || ""}
                      onChange={(e) => updatePriorityEmployee(priorityIndex, e.target.value)}
                    >
                      <option value="">Select colleague</option>
                      {leaveMeta.colleagues.map((colleague) => (
                        <option key={`${priorityIndex}-${colleague.employeeId}`} value={colleague.employeeId}>
                          {colleague.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <div>
                  <label>Emergency Contact 1</label>
                  <input
                    type="text"
                    placeholder="Emergency Contact 1"
                    value={leaveForm.emergencyContact1}
                    onChange={(e) => setLeaveForm((currentForm) => ({ ...currentForm, emergencyContact1: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Emergency Contact 2</label>
                  <input
                    type="text"
                    placeholder="Emergency Contact 2"
                    value={leaveForm.emergencyContact2}
                    onChange={(e) => setLeaveForm((currentForm) => ({ ...currentForm, emergencyContact2: e.target.value }))}
                  />
                </div>
              </div>

              <label>Priority Flow</label>
              <input
                type="text"
                value={priorityNamesPreview.length ? `${priorityNamesPreview.join(" -> ")} -> Admin` : ""}
                readOnly
                placeholder="Choose 3 employees in priority order"
              />

              <label>Address During Leave</label>
              <textarea
                placeholder="Address During Leave"
                value={leaveForm.address}
                onChange={(e) => setLeaveForm((currentForm) => ({ ...currentForm, address: e.target.value }))}
              />

              <label>Reason For Leave</label>
              <textarea
                placeholder="Reason for Leave"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm((currentForm) => ({ ...currentForm, reason: e.target.value }))}
              />

              <button onClick={applyLeave}>Apply Leave</button>
            </div>

            <div className="form-container">
              <h3>Filter Leave By Date</h3>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Days</th>
                    <th>Priority Coverage</th>
                    <th>Leave Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.length ? (
                    filteredLeaves.map((leave) => (
                      <tr key={leave.id}>
                        <td>{leave.fromDate} to {leave.toDate}</td>
                        <td>{leave.daysCount}</td>
                        <td>{renderCoveragePriority(leave)}</td>
                        <td>{leave.reason}</td>
                        <td>
                          <span className={`status-badge status-${leave.status.toLowerCase().replace(/\s+/g, "-")}`}>
                            {leave.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5">No leave records found for the selected date.</td>
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

export default Leave;
