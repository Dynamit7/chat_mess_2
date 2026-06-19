import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { IMail, ILock } from "../components/Icon";
import { authApi } from "../api/client";
import { useToast } from "../context/ToastContext";

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!email || !password) return setErr("Enter your email and password.");
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      toast.success("Verification code sent to your email.");
      navigate("/verify", { state: { userId: res.userId, email } });
    } catch (e) {
      setErr(e?.response?.data?.error || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2>Welcome back</h2>
      <p className="sub">Sign in to continue to your conversations.</p>
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label>Email</label>
          <div className="input-wrap">
            <span className="icon"><IMail size={18} /></span>
            <input
              className="input has-icon"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        <div className="field">
          <label>Password</label>
          <div className="input-wrap">
            <span className="icon"><ILock size={18} /></span>
            <input
              className="input has-icon"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <span className="error-text">{err}</span>
        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <span className="spinner" /> : "Continue"}
        </button>
      </form>
      <div className="auth-foot">
        New to Talkify? <Link to="/register">Create an account</Link>
      </div>
    </AuthLayout>
  );
}
