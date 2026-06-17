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

const ROLE_ORDER = ["Admin", "Front Office", "Sales"];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useApp();

  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
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

  const byRole = users.reduce<Record<string, ApiUser[]>>((acc, u) => {
    if (!acc[u.role]) acc[u.role] = [];
    acc[u.role].push(u);
    return acc;
  }, {});

  const availableRoles = ROLE_ORDER.filter((r) => (byRole[r]?.length ?? 0) > 0);

  const onSelectRole = (role: string) => {
    if (selectedRole === role) {
      setSelectedRole(null);
      setSelectedUser(null);
      setPassword("");
      setError("");
      setForgotMsg(false);
      return;
    }
    setSelectedRole(role);
    setSelectedUser(null);
    setPassword("");
    setError("");
    setForgotMsg(false);
    const usersInRole = byRole[role] ?? [];
    if (usersInRole.length === 1) {
      setSelectedUser(usersInRole[0]);
    }
  };

  const onPickUserInRole = (role: string, userId: string) => {
    setSelectedRole(role);
    const u = users.find((x) => x.id === userId) ?? null;
    setSelectedUser(u);
    setPassword("");
    setError("");
    setForgotMsg(false);
  };

  const onLogin = async () => {
    if (!selectedUser) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selectedUser.email, password }),
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
        ) : availableRoles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", fontSize: 13, color: "var(--t3)" }}>
            No users found. Contact your administrator.
          </div>
        ) : (
          <div className="role-grid">
            {availableRoles.map((role) => {
              const usersInRole = byRole[role] ?? [];
              const isSelected = selectedRole === role;
              const hasMultiple = usersInRole.length > 1;

              if (hasMultiple) {
                const picked = selectedRole === role && selectedUser ? selectedUser : null;
                return (
                  <div
                    key={role}
                    className={`role-btn${picked ? " selected" : ""}`}
                    style={{ cursor: "default" }}
                  >
                    <div className="role-btn-name">{role}</div>
                    <select
                      value={picked?.id ?? ""}
                      onChange={(e) => onPickUserInRole(role, e.target.value)}
                      style={{
                        marginTop: 6,
                        width: "100%",
                        fontSize: 12,
                        padding: "4px 6px",
                        borderRadius: 6,
                        border: picked ? "1px solid rgba(255,255,255,0.25)" : "1px solid var(--bd)",
                        background: picked ? "rgba(255,255,255,0.12)" : "var(--surf)",
                        color: picked ? "#fff" : "var(--t1)",
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      <option value="" disabled>Select user...</option>
                      {usersInRole.map((u) => (
                        <option key={u.id} value={u.id} style={{ color: "var(--t1)", background: "var(--surf)" }}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                );
              }

              return (
                <button
                  key={role}
                  type="button"
                  className={`role-btn${isSelected ? " selected" : ""}`}
                  onClick={() => onSelectRole(role)}
                >
                  <div className="role-btn-name">{role}</div>
                  <div className="role-btn-desc">{usersInRole[0]?.name}</div>
                </button>
              );
            })}
          </div>
        )}

        {selectedUser && (
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
          disabled={!selectedUser || !password || submitting}
          style={{
            opacity: !selectedUser || !password || submitting ? 0.5 : 1,
            cursor: !selectedUser || !password || submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Signing in..." : "Enter"}
        </button>
      </div>
    </div>
  );
}
