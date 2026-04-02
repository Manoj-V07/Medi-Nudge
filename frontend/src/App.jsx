import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";
import Prescription from "./pages/Prescription";
import HealthDashboard from "./pages/HealthDashboard";
import HospitalSOS from "./pages/HospitalSOS";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/health" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/health"
        element={
          <ProtectedRoute>
            <HealthDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/emergency"
        element={
          <ProtectedRoute>
            <HospitalSOS />
          </ProtectedRoute>
        }
      />
      <Route
        path="/prescription"
        element={
          <ProtectedRoute>
            <Prescription />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
