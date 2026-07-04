import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../App.css";
import { post } from "../api";

function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    department: "IT",
    role: "employee",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updateField = (field, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSignup = async () => {
    setLoading(true);
    setError("");

    try {
      await post("/auth/signup", form);
      navigate("/", {
        state: {
          signupSuccess: "Account created successfully. Please login with your email and password.",
          signupEmail: form.email,
        },
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Create Account</h2>

        {error && <div className="message error auth-message">{error}</div>}

        <input
          type="text"
          placeholder="Full Name"
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
        />

        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => updateField("email", e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => updateField("password", e.target.value)}
        />

        <div className="role-container">
          <label>Department</label>
          <select
            value={form.department}
            onChange={(e) => updateField("department", e.target.value)}
          >
            <option value="IT">IT</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
            <option value="Operations">Operations</option>
          </select>
        </div>

        <div className="role-container">
          <label>Role</label>
          <select
            value={form.role}
            onChange={(e) => updateField("role", e.target.value)}
          >
            <option value="admin">Admin</option>
            <option value="employee">Employee</option>
          </select>
        </div>

        <button onClick={handleSignup} disabled={loading}>
          {loading ? "Creating account..." : "Sign Up"}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
