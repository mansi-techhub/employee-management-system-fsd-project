import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboard from "./pages/AdminDashboard";
import Attendance from "./pages/Attendance";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import EmployeeList from "./pages/EmployeeList";
import Leave from "./pages/Leave";
import Login from "./pages/Login";
import Performance from "./pages/Performance";
import Salary from "./pages/Salary";
import Signup from "./pages/Signup";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee"
          element={
            <ProtectedRoute role="employee">
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add"
          element={
            <ProtectedRoute role="admin">
              <Navigate to="/list" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/list"
          element={
            <ProtectedRoute role="admin">
              <EmployeeList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <Attendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leave"
          element={
            <ProtectedRoute>
              <Leave />
            </ProtectedRoute>
          }
        />
        <Route
          path="/performance"
          element={
            <ProtectedRoute>
              <Performance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/salary"
          element={
            <ProtectedRoute>
              <Salary />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
