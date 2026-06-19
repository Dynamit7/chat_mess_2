import { motion } from "framer-motion";
import { IShield } from "./Icon";

// Split-screen premium auth layout: branded hero on the left, form card on the right.
export default function AuthLayout({ children }) {
  return (
    <div className="auth-screen">
      <div className="auth-hero">
        <div className="brand">
          <span className="mark">
            <IShield size={22} />
          </span>
          Talkify
        </div>

        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1>
            Conversations,
            <br />
            <span className="grad-text">encrypted by design.</span>
          </h1>
          <p>
            A private messaging space built for speed and trust — end-to-end
            encryption, real-time delivery, and a interface that feels effortless.
          </p>
          <div className="hero-badges">
            <span className="hero-badge"><span className="hero-dot" /> End-to-end encrypted</span>
            <span className="hero-badge"><span className="hero-dot" /> Real-time</span>
            <span className="hero-badge"><span className="hero-dot" /> Two-factor secure</span>
          </div>

          <a className="apk-download" href="/talkify.apk" download="Talkify.apk">
            <span className="apk-download-icon" aria-hidden="true">▼</span>
            <span className="apk-download-text">
              <strong>Download for Android</strong>
              <small>Talkify APK · v1.0.0</small>
            </span>
          </a>
        </motion.div>

        <div style={{ color: "var(--text-faint)", fontSize: 13 }}>
          © {new Date().getFullYear()} Talkify. All rights reserved.
        </div>
      </div>

      <div className="auth-panel">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>

        {/* Shown only when the hero (and its download button) is hidden — i.e. on
            phones/narrow screens, which is exactly where people install the APK. */}
        <a className="apk-download apk-download--panel" href="/talkify.apk" download="Talkify.apk">
          <span className="apk-download-icon" aria-hidden="true">▼</span>
          <span className="apk-download-text">
            <strong>Download for Android</strong>
            <small>Talkify APK · v1.0.0</small>
          </span>
        </a>
      </div>
    </div>
  );
}
