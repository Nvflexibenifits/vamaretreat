"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import type { Role } from "@/types";

const ROLES: { role: Role; name: string; desc: string; user: string }[] = [
  { role: "Sales REX", name: "Sales REX", desc: "Karthik — Front-line sales", user: "Karthik" },
  { role: "Sales REX", name: "Sales REX", desc: "Anagha — Front-line sales", user: "Anagha" },
  { role: "Room Allocator", name: "Room Allocator", desc: "Rahul — Room assignments", user: "Rahul" },
  { role: "Manager", name: "Manager", desc: "Priya — Operations manager", user: "Priya" },
  { role: "Admin", name: "Admin / Owner", desc: "Full access", user: "Owner" },
];

const PASSWORD = "test@123";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthed, login } = useApp();
  const [selected, setSelected] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [forgotMsg, setForgotMsg] = useState(false);

  useEffect(() => {
    if (isAuthed) router.replace("/");
  }, [isAuthed, router]);

  const onSelect = (i: number) => {
    setSelected(i);
    setPassword("");
    setError("");
    setForgotMsg(false);
  };

  const onLogin = () => {
    if (selected === null) return;
    if (password !== PASSWORD) {
      setError("Incorrect password. Please try again.");
      return;
    }
    const r = ROLES[selected];
    login(r.role, r.user);
    router.replace("/");
  };

  return (
    <div id="login-screen">
      <div className="login-box">
        <div className="login-logo">
          <div className="login-mark">VR</div>
          <div>
            <div className="login-title">Vama Retreats</div>
            <div className="login-sub">Back Office · Internal Tool</div>
          </div>
        </div>
        <div className="login-section-label">Select your role to continue</div>
        <div className="role-grid">
          {ROLES.map((r, i) => (
            <button
              key={i}
              type="button"
              className={`role-btn${selected === i ? " selected" : ""}`}
              onClick={() => onSelect(i)}
            >
              <div className="role-btn-name">{r.name}</div>
              <div className="role-btn-desc">{r.desc}</div>
            </button>
          ))}
        </div>

        {selected !== null && (
          <div style={{ marginBottom: 16 }}>
            <div className="login-section-label">Enter Password</div>
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onLogin();
                }}
                placeholder="••••••••"
                autoFocus
                style={{
                  width: "100%",
                  padding: "11px 44px 11px 13px",
                  border: `1.5px solid ${error ? "var(--red)" : "var(--bd)"}`,
                  borderRadius: "var(--r2)",
                  fontSize: 14,
                  color: "var(--t1)",
                  background: "var(--surf)",
                  outline: "none",
                  transition: "border-color .15s",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  padding: "4px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--t3)",
                  cursor: "pointer",
                }}
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? "🙈" : "👁"}
              </button>
            </div>
            {error && (
              <div style={{ fontSize: 11, color: "var(--red)", marginTop: 6 }}>{error}</div>
            )}
            <button
              type="button"
              onClick={() => setForgotMsg(true)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                marginTop: 8,
                fontSize: 11,
                color: "var(--acc)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Forgot Password?
            </button>
            {forgotMsg && (
              <div
                style={{
                  marginTop: 8,
                  padding: "10px 12px",
                  background: "var(--acc-lt)",
                  border: "1px solid var(--acc-bg)",
                  borderRadius: "var(--r2)",
                  fontSize: 11,
                  color: "var(--t2)",
                  lineHeight: 1.5,
                }}
              >
                A password reset link will be sent to the admin email. Please contact your administrator.
              </div>
            )}
          </div>
        )}

        <button
          className="btn-login"
          onClick={onLogin}
          disabled={selected === null || !password}
          style={{
            opacity: selected === null || !password ? 0.5 : 1,
            cursor: selected === null || !password ? "not-allowed" : "pointer",
          }}
        >
          Enter Back Office →
        </button>
        <div className="login-hint">Demo mode — all data is in-memory</div>
      </div>
    </div>
  );
}
