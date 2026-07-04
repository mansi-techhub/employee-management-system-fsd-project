import { Navigate } from "react-router-dom";
import { getCurrentUser } from "../auth";

function ProtectedRoute({ children, role }) {
  const user = getCurrentUser();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/employee"} replace />;
  }

  return children;
}

export default ProtectedRoute;
