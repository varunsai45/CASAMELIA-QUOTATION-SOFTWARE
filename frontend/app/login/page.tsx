"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import BrandLogo from "@/components/BrandLogo";
export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <div className="login-brand">
        <BrandLogo />
        <p>QUOTATION SOFTWARE</p>
        <div className="login-note">
          A considered approach
          <br />
          to every quotation.
        </div>
        <small>CASAMELIA INTERNATIONAL</small>
      </div>
      <div className="login-form">
        <div>
          <span className="eyebrow">YOUR QUOTATION WORKSPACE</span>
          <h1>Welcome back.</h1>
          <p className="muted">
            Sign in to prepare and manage customer quotations.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                await api("/auth/login", "POST", {
                  username: f.get("username"),
                  password: f.get("password"),
                });
                router.replace("/");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Username
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            <button className="button login-button" disabled={busy}>
              {busy ? "Signing in…" : "LOGIN"}
            </button>
          </form>
          <small className="muted">
            Access is limited to authorized Casamelia staff.
          </small>
        </div>
      </div>
    </div>
  );
}
