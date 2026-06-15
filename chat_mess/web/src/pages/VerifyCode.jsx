import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { authApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const LEN = 6;

export default function VerifyCode() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { signIn } = useAuth();
  const toast = useToast();
  const [digits, setDigits] = useState(Array(LEN).fill(""));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const refs = useRef([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  if (!state?.userId) return <Navigate to="/login" replace />;

  const code = digits.join("");

  const onChange = (i, v) => {
    const ch = v.replace(/\D/g, "").slice(-1);
    setErr("");
    setDigits((d) => {
      const next = [...d];
      next[i] = ch;
      return next;
    });
    if (ch && i < LEN - 1) refs.current[i + 1]?.focus();
  };

  const onKey = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const onPaste = (e) => {
    const txt = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, LEN);
    if (!txt) return;
    e.preventDefault();
    const next = Array(LEN).fill("");
    txt.split("").forEach((c, idx) => (next[idx] = c));
    setDigits(next);
    refs.current[Math.min(txt.length, LEN - 1)]?.focus();
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (code.length !== LEN) return setErr("Enter the 6-digit code.");
    setLoading(true);
    setErr("");
    try {
      const res = await authApi.verifyCode({ userId: state.userId, code });
      if (res.requiresTwoFactor) {
        navigate("/2fa", { state: { userId: res.userId } });
        return;
      }
      signIn(res);
      toast.success("Welcome back!");
      navigate("/", { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.error || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2>Verify it's you</h2>
      <p className="sub">
        We sent a 6-digit code to <b>{state.email || "your email"}</b>.
      </p>
      <form className="auth-form" onSubmit={submit}>
        <div className="code-row" onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (refs.current[i] = el)}
              className="code-box"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => onChange(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
            />
          ))}
        </div>
        <span className="error-text">{err}</span>
        <button className="btn btn-primary btn-block" disabled={loading || code.length !== LEN}>
          {loading ? <span className="spinner" /> : "Verify"}
        </button>
      </form>
      <div className="auth-foot">
        Wrong account? <Link to="/login">Start over</Link>
      </div>
    </AuthLayout>
  );
}
