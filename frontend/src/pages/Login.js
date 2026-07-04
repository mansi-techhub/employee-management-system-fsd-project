import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../App.css";
import { post } from "../api";
import { setCurrentUser } from "../auth";

function Login() {
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(location.state?.signupSuccess || "");

  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.signupEmail) {
      setUsername(location.state.signupEmail);
    }
  }, [location.state]);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await post("/auth/login", {
        username,
        password,
        role,
      });

      setCurrentUser(response.user);
      navigate(response.user.role === "admin" ? "/admin" : "/employee");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Employee Management System</h2>

        {success && <div className="message success auth-message">{success}</div>}
        {error && <div className="message error auth-message">{error}</div>}

        <input
          type="text"
          placeholder="Username or Email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="role-container">
          <label>Select Role</label>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="admin">Admin</option>
            <option value="employee">Employee</option>
          </select>
        </div>

        <button onClick={handleLogin} disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>

        <p className="auth-switch">
          New user? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
