import React, { useCallback, useEffect, useState } from "react";
import { get, patch } from "../api";
import { getCurrentUser } from "../auth";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

function Performance() {
  const user = getCurrentUser();
  const role = user.role;
  const organizationId = user.organizationId || "";
  const [performance, setPerformance] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPerformance = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        role,
        employeeId: user.employeeId,
      });

      if (role === "admin" && organizationId) {
        params.set("organizationId", organizationId);
      }

      const response = await get(`/performance?${params.toString()}`);
      setPerformance(response.reviews);
      setDrafts(
        (response.reviews || []).reduce((currentDrafts, review) => {
          currentDrafts[review.employeeId] = {
            rating: review.rating,
            review: review.review || "",
          };
          return currentDrafts;
        }, {})
      );
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [organizationId, role, user.employeeId]);

  useEffect(() => {
    loadPerformance();
  }, [loadPerformance]);

  const updatePerformance = async (employeeId) => {
    setMessage("");
    setError("");

    try {
      const draft = drafts[employeeId];

      if (!draft?.review?.trim()) {
        setError("Please enter a review before saving performance.");
        return;
      }

      await patch(`/performance/${employeeId}`, {
        rating: draft.rating,
        review: draft.review.trim(),
      });
      setMessage("Performance updated successfully.");
      loadPerformance();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="layout">
      <Sidebar />

      <div className="main">
        <Navbar />

        <h2 className="page-title">Performance</h2>

        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}

        {role === "admin" ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Rating</th>
                  <th>Review</th>
                  <th>Edit</th>
                </tr>
              </thead>

              <tbody>
                {performance.map((review) => (
                  <tr key={review.employeeId}>
                    <td>{review.employeeName}</td>
                    <td>
                      <div className="stack-list">
                        <span className={`status-badge status-${(drafts[review.employeeId]?.rating || review.rating).toLowerCase().replace(/\s+/g, "-")}`}>
                          {drafts[review.employeeId]?.rating || review.rating}
                        </span>
                        <select
                          value={drafts[review.employeeId]?.rating || review.rating}
                          onChange={(event) =>
                            setDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [review.employeeId]: {
                                ...(currentDrafts[review.employeeId] || {}),
                                rating: event.target.value,
                              },
                            }))
                          }
                        >
                          <option value="Excellent">Excellent</option>
                          <option value="Good">Good</option>
                          <option value="Average">Average</option>
                          <option value="Needs Improvement">Needs Improvement</option>
                        </select>
                      </div>
                    </td>
                    <td>
                      <textarea
                        value={drafts[review.employeeId]?.review || ""}
                        onChange={(event) =>
                          setDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [review.employeeId]: {
                              ...(currentDrafts[review.employeeId] || {}),
                              review: event.target.value,
                            },
                          }))
                        }
                        rows={3}
                        placeholder="Type manager review here"
                      />
                    </td>
                    <td className="table-actions">
                      <button className="primary-btn" onClick={() => updatePerformance(review.employeeId)}>Save Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cards">
            {performance.map((review) => (
              <div className="card green" key={`${review.employeeId}-${review.month}`}>
                <h4>{review.month} Performance</h4>
                <p>{review.rating}</p>
                <div className="muted">{review.review}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Performance;
