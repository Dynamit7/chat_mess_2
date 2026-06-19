import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { IUser, IMail, ILock } from "../components/Icon";
import { authApi } from "../api/client";
import { useToast } from "../context/ToastContext";

export default function Register() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.username || !form.email || !form.password)
      return setErr("Please fill in all fields.");
    if (form.password.length < 6) return setErr("Password must be at least 6 characters.");
    setLoading(true);
    try {
      await authApi.register(form);
      // Account created — immediately request a login code and head to verify.
      const res = await authApi.login({ email: form.email, password: form.password });
      toast.success("Account created. Check your email for the code.");
      navigate("/verify", { state: { userId: res.userId, email: form.email } });
    } catch (e) {
      setErr(e?.response?.data?.error || "Could not create your account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2>Create your account</h2>
      <p className="sub">Join Talkify in under a minute.</p>
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label>Username</label>
          <div className="input-wrap">
            <span className="icon"><IUser size={18} /></span>
            <input
              className="input has-icon"
              placeholder="yourname"
              value={form.username}
              onChange={set("username")}
              autoFocus
            />
          </div>
        </div>
        <div className="field">
          <label>Email</label>
          <div className="input-wrap">
            <span className="icon"><IMail size={18} /></span>
            <input
              className="input has-icon"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set("email")}
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
              placeholder="At least 6 characters"
              value={form.password}
              onChange={set("password")}
            />
          </div>
        </div>
        <span className="error-text">{err}</span>
        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <span className="spinner" /> : "Create account"}
        </button>
      </form>
      <div className="auth-foot">
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </AuthLayout>
  );
}
