import { useState } from "react";
import { useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { IKey } from "../components/Icon";
import { authApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function TwoFactor() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { signIn } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  if (!state?.userId) return <Navigate to="/login" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!pw) return setErr("Enter your two-factor password.");
    setLoading(true);
    setErr("");
    try {
      const res = await authApi.verifyTwoFactor({
        userId: state.userId,
        twoFactorPassword: pw,
      });
      signIn(res);
      toast.success("Welcome back!");
      navigate("/", { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.error || "Invalid two-factor password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2>Two-factor security</h2>
      <p className="sub">This account is protected. Enter your 2FA password to continue.</p>
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label>Two-factor password</label>
          <div className="input-wrap">
            <span className="icon"><IKey size={18} /></span>
            <input
              className="input has-icon"
              type="password"
              placeholder="••••••••"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <span className="error-text">{err}</span>
        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <span className="spinner" /> : "Unlock"}
        </button>
      </form>
      <div className="auth-foot">
        <Link to="/login">Back to sign in</Link>
      </div>
    </AuthLayout>
  );
}
