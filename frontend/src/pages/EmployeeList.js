import { useCallback, useEffect, useMemo, useState } from "react";
import { del, get, post, put } from "../api";
import { getCurrentUser } from "../auth";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const emptyForm = {
  name: "",
  email: "",
  contactNumber: "",
  address: "",
  department: "IT",
  designation: "",
  salary: "",
  joinDate: "",
  status: "Active",
};

function EmployeeList() {
  const currentUser = getCurrentUser() || {};
  const organizationId = currentUser.organizationId || "";
  const [employees, setEmployees] = useState([]);
  const [searchEmployeeId, setSearchEmployeeId] = useState("");
  const [searchDepartment, setSearchDepartment] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingEmployeeId, setEditingEmployeeId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const filteredEmployees = useMemo(() => {
    const matchedEmployees = employees.filter((employee) => {
      const matchesEmployeeId = searchEmployeeId
        ? employee.employeeId?.toLowerCase().includes(searchEmployeeId.toLowerCase())
        : true;

      const matchesDepartment = searchDepartment
        ? employee.department === searchDepartment
        : true;

      return matchesEmployeeId && matchesDepartment;
    });

    return matchedEmployees.sort((left, right) => {
      const leftNumber = Number(String(left.employeeId || "").replace(/\D/g, "")) || 0;
      const rightNumber = Number(String(right.employeeId || "").replace(/\D/g, "")) || 0;
      return leftNumber - rightNumber;
    });
  }, [employees, searchDepartment, searchEmployeeId]);

  const loadEmployees = useCallback(async () => {
    if (!organizationId) {
      setEmployees([]);
      return;
    }

    try {
      const params = new URLSearchParams();
      params.set("organizationId", organizationId);
      if (searchEmployeeId) {
        params.set("employeeId", searchEmployeeId);
      }
      if (searchDepartment) {
        params.set("department", searchDepartment);
      }

      const query = params.toString() ? `?${params.toString()}` : "";
      const response = await get(`/employees${query}`);
      setEmployees(response.employees);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [organizationId, searchDepartment, searchEmployeeId]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const submitEmployee = async () => {
    setError("");
    setMessage("");

    try {
      if (editingEmployeeId) {
        await put(`/employees/${editingEmployeeId}`, {
          ...form,
          organizationId,
        });
        setMessage("Employee updated successfully.");
      } else {
        const response = await post("/employees", {
          ...form,
          organizationId,
        });
        setMessage(`Employee added successfully. Generated Employee ID: ${response.employee.employeeId}`);
      }

      setForm(emptyForm);
      setEditingEmployeeId("");
      loadEmployees();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const startEdit = (employee) => {
    setEditingEmployeeId(employee.employeeId);
    setForm({
      name: employee.name,
      email: employee.email,
      contactNumber: employee.contactNumber || "",
      address: employee.address || "",
      department: employee.department,
      designation: employee.designation,
      salary: employee.salary,
      joinDate: employee.joinDate,
      password: "",
      status: employee.status || "Active",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteEmployee = async (employeeId) => {
    setError("");
    setMessage("");

    try {
      await del(`/employees/${employeeId}`);
      setMessage("Employee deleted successfully.");
      if (editingEmployeeId === employeeId) {
        setEditingEmployeeId("");
        setForm(emptyForm);
      }
      loadEmployees();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setMessage("");

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);

    if (lines.length < 2) {
      setError("CSV file must include a header row and at least one employee row.");
      return;
    }

    const headers = lines[0].split(",").map((header) => header.trim());
    const employeesToImport = lines.slice(1).map((line) => {
      const values = line.split(",").map((value) => value.trim());
      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      return {
        name: row.name || "",
        email: row.email || "",
        contactNumber: row.contactNumber || "",
        address: row.address || "",
        department: row.department || "IT",
        designation: row.designation || "Employee",
        salary: row.salary || 0,
        joinDate: row.joinDate || "",
        organizationId,
      };
    });

    try {
      const response = await post("/employees/bulk", { employees: employeesToImport });
      setMessage(response.message);
      loadEmployees();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      event.target.value = "";
    }
  };

  const csvExample = useMemo(
    () => "name,email,contactNumber,address,department,designation,salary,joinDate",
    []
  );

  return (
    <div className="layout">
      <Sidebar />

      <div className="main">
        <Navbar />

        <h2 className="page-title">Employee List</h2>

        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}

        <div className="summary-grid">
          <div className="summary-card">
            <h3>{editingEmployeeId ? "Update Employee" : "Add Employee Manually"}</h3>
            <div className="form-grid">
              <input placeholder="Full Name" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
              <input placeholder="Email Address" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} />
              <input placeholder="Contact Number" value={form.contactNumber} onChange={(e) => setForm((current) => ({ ...current, contactNumber: e.target.value }))} />
              <input placeholder="Address" value={form.address} onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))} />
              <select value={form.department} onChange={(e) => setForm((current) => ({ ...current, department: e.target.value }))}>
                <option value="IT">IT</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
              </select>
              <input placeholder="Designation" value={form.designation} onChange={(e) => setForm((current) => ({ ...current, designation: e.target.value }))} />
              <input placeholder="Monthly Salary" type="number" value={form.salary} onChange={(e) => setForm((current) => ({ ...current, salary: e.target.value }))} />
              <input type="date" value={form.joinDate} onChange={(e) => setForm((current) => ({ ...current, joinDate: e.target.value }))} />
              {editingEmployeeId && (
                <select value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              )}
            </div>
            <div className="table-actions" style={{ justifyContent: "flex-start", marginTop: "12px" }}>
              <button className="primary-btn" onClick={submitEmployee}>{editingEmployeeId ? "Update Employee" : "Add Employee"}</button>
              {editingEmployeeId && <button className="ghost-btn" onClick={() => { setEditingEmployeeId(""); setForm(emptyForm); }}>Cancel</button>}
            </div>
          </div>

          <div className="summary-card">
            <h3>Bulk Upload</h3>
            <p className="muted">Upload a CSV sheet with this header format:</p>
            <p className="muted">{csvExample}</p>
            <input type="file" accept=".csv" onChange={handleCsvUpload} />
          </div>
        </div>

        <div className="summary-card" style={{ margin: "20px" }}>
          <h3>Search Employees</h3>
          <div className="form-grid">
            <input placeholder="Search by Employee ID" value={searchEmployeeId} onChange={(e) => setSearchEmployeeId(e.target.value)} />
            <select value={searchDepartment} onChange={(e) => setSearchDepartment(e.target.value)}>
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
                <th>ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Salary</th>
                <th>Joining Date</th>
                <th>Email</th>
                <th>Contact No</th>
                <th>Address</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.length ? (
                filteredEmployees.map((emp) => (
                  <tr key={emp.employeeId}>
                    <td>{emp.employeeId}</td>
                    <td>{emp.name}</td>
                    <td>{emp.department}</td>
                    <td>{emp.designation}</td>
                    <td>{emp.salary}</td>
                    <td>{emp.joinDate}</td>
                    <td>{emp.email}</td>
                    <td>{emp.contactNumber || "NA"}</td>
                    <td>{emp.address || "NA"}</td>
                    <td className="table-actions">
                      <button className="secondary-btn" onClick={() => startEdit(emp)}>Update</button>
                      <button className="danger-btn" onClick={() => deleteEmployee(emp.employeeId)}>Delete</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10">No employee records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default EmployeeList;
