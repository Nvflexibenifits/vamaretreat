"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";

type ApiUser = {
  id: string;
  name: string;
  role: string;
  email: string;
  color: string;
  active: boolean;
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useApp();

  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotMsg, setForgotMsg] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data: ApiUser[]) => setUsers(data.filter((u) => u.active)))
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, []);

  const onSelect = (i: number) => {
    setSelected(i);
    setPassword("");
    setError("");
    setForgotMsg(false);
  };

  const onLogin = async () => {
    if (selected === null) return;
    const u = users[selected];
    if (!u) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: u.email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Incorrect password. Please try again.");
        return;
      }

      login(data.user.role as never, data.user.name);
      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="login-screen">
      <div className="login-box">
        <div className="login-logo">
          <div>
            <div className="login-title">Vama Retreats</div>
            <div className="login-sub">Reservation Management System</div>
          </div>
        </div>

        {loadingUsers ? (
          <div style={{ textAlign: "center", padding: "24px 0", fontSize: 13, color: "var(--t3)" }}>
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", fontSize: 13, color: "var(--t3)" }}>
            No users found. Contact your administrator.
          </div>
        ) : (
          <div className="role-grid">
            {users.map((u, i) => (
              <button
                key={u.id}
                type="button"
                className={`role-btn${selected === i ? " selected" : ""}`}
                onClick={() => onSelect(i)}
              >
                <div className="role-btn-name">{u.role}</div>
                <div className="role-btn-desc">{u.name}</div>
              </button>
            ))}
          </div>
        )}

        {selected !== null && (
          <div style={{ marginBottom: 16 }}>
            <div className="login-section-label">Enter Password</div>
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") onLogin(); }}
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
                  position: "absolute", right: 8, top: "50%",
                  transform: "translateY(-50%)", background: "transparent",
                  border: "none", padding: "4px 8px", fontSize: 12,
                  fontWeight: 600, color: "var(--t3)", cursor: "pointer",
                }}
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
            {error && (
              <div style={{ fontSize: 11, color: "var(--red)", marginTop: 6 }}>{error}</div>
            )}
            <button
              type="button"
              onClick={() => setForgotMsg(true)}
              style={{
                background: "transparent", border: "none", padding: 0,
                marginTop: 8, fontSize: 11, color: "var(--acc)",
                cursor: "pointer", fontWeight: 600,
              }}
            >
              Forgot Password?
            </button>
            {forgotMsg && (
              <div style={{
                marginTop: 8, padding: "10px 12px",
                background: "var(--acc-lt)", border: "1px solid var(--acc-bg)",
                borderRadius: "var(--r2)", fontSize: 11, color: "var(--t2)", lineHeight: 1.5,
              }}>
                Please contact your administrator to reset your password.
              </div>
            )}
          </div>
        )}

        <button
          className="btn-login"
          onClick={onLogin}
          disabled={selected === null || !password || submitting}
          style={{
            opacity: selected === null || !password || submitting ? 0.5 : 1,
            cursor: selected === null || !password || submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Signing in..." : "Enter"}
        </button>
      </div>
    </div>
  );
}
