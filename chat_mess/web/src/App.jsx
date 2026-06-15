import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyCode from "./pages/VerifyCode";
import TwoFactor from "./pages/TwoFactor";
import Workspace from "./sections/Workspace";

function Protected({ children }) {
  const { isAuthed } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <SocketProvider>{children}</SocketProvider>;
}

function GuestOnly({ children }) {
  const { isAuthed } = useAuth();
  if (isAuthed) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/verify" element={<GuestOnly><VerifyCode /></GuestOnly>} />
      <Route path="/2fa" element={<GuestOnly><TwoFactor /></GuestOnly>} />
      <Route path="/" element={<Protected><Workspace /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
