import { useState } from "react";
import { post } from "../api";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

function AddEmployee() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    department: "IT",
    designation: "",
    salary: "",
    joinDate: "",
    manager: "",
    password: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const updateField = (field, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const submit = async () => {
    setMessage("");
    setError("");

    try {
      const response = await post("/employees", form);
      setMessage(`Employee added successfully. Generated Employee ID: ${response.employee.employeeId}`);
      setForm({
        name: "",
        email: "",
        department: "IT",
        designation: "",
        salary: "",
        joinDate: "",
        manager: "",
        password: "",
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="layout">
      <Sidebar />

      <div className="main">
        <Navbar />

        <h2 className="page-title">Add Employee</h2>

        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}

        <div className="form-container">
          <div className="form-grid">
            <input placeholder="Full Name" value={form.name} onChange={(e) => updateField("name", e.target.value)} />
            <input placeholder="Email Address" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
            <select value={form.department} onChange={(e) => updateField("department", e.target.value)}>
              <option value="IT">IT</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
            </select>
            <input placeholder="Designation" value={form.designation} onChange={(e) => updateField("designation", e.target.value)} />
            <input placeholder="Monthly Salary" type="number" value={form.salary} onChange={(e) => updateField("salary", e.target.value)} />
            <input type="date" value={form.joinDate} onChange={(e) => updateField("joinDate", e.target.value)} />
            <input placeholder="Manager Name" value={form.manager} onChange={(e) => updateField("manager", e.target.value)} />
            <input placeholder="Temporary Password" type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} />
          </div>

          <button className="primary-btn" onClick={submit}>Add Employee</button>
        </div>
      </div>
    </div>
  );
}

export default AddEmployee;
