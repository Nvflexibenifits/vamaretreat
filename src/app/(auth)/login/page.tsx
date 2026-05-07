"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import type { Role } from "@/types";

const ROLES: { role: Role; name: string; desc: string }[] = [
  { role: "Sales REX", name: "Sales REX", desc: "Karthik — Front-line sales" },
  { role: "Sales REX", name: "Sales REX", desc: "Anagha — Front-line sales" },
  { role: "Room Allocator", name: "Room Allocator", desc: "Rahul — Room assignments" },
  { role: "Manager", name: "Manager", desc: "Priya — Operations manager" },
  { role: "Admin", name: "Admin / Owner", desc: "Full access" },
];

const USER_NAMES = ["Karthik", "Anagha", "Rahul", "Priya", "Owner"];

export default function LoginPage() {
  const router = useRouter();
  const { isAuthed, login } = useApp();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (isAuthed) router.replace("/");
  }, [isAuthed, router]);

  const onLogin = () => {
    const r = ROLES[selected];
    login(r.role, USER_NAMES[selected]);
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
              onClick={() => setSelected(i)}
            >
              <div className="role-btn-name">{r.name}</div>
              <div className="role-btn-desc">{r.desc}</div>
            </button>
          ))}
        </div>
        <button className="btn-login" onClick={onLogin}>
          Enter Back Office →
        </button>
        <div className="login-hint">Demo mode — all data is in-memory</div>
      </div>
    </div>
  );
}
