"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
export default function Account() {
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <Shell>
      <h1>Change password</h1>
      <section className="panel form-panel">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await api("/auth/change-password", "POST", {
                current_password: f.get("current"),
                new_password: f.get("new"),
              });
              router.push("/login");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            Current password
            <input
              type="password"
              name="current"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              name="new"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="button">Change password & sign out</button>
        </form>
      </section>
    </Shell>
  );
}
