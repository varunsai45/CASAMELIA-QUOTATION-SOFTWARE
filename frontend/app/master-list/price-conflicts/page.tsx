"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api, currency } from "@/lib/api";
import { Conflict } from "@/lib/types";
export default function Conflicts() {
  const [records, setRecords] = useState<Conflict[]>([]);
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const load = () =>
    api<Conflict[]>("/price-conflicts")
      .then(setRecords)
      .catch((e) => setError(e.message));
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    setResolved(status === "resolved");
    load();
  }, []);
  async function resolve(c: Conflict, source: string) {
    setBusy(c.id);
    setError("");
    try {
      await api(`/price-conflicts/${c.id}/resolve`, "POST", { source });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <Shell adminOnly>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MASTER LIST → PRICE CONFLICTS</span>
          <h1>Resolve pricing differences</h1>
          <p className="muted">
            Both original values are preserved. Select the official price for
            each combination.
          </p>
        </div>
        <span className="badge conflict">
          {records.filter((c) => c.status === "unresolved").length} unresolved
        </span>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <div className="toolbar">
        <button
          className={!resolved ? "button" : "button secondary"}
          onClick={() => setResolved(false)}
        >
          Unresolved
        </button>
        <button
          className={resolved ? "button" : "button secondary"}
          onClick={() => setResolved(true)}
        >
          Resolved history
        </button>
      </div>
      <div className="conflict-grid">
        {records
          .filter((c) =>
            resolved ? c.status === "resolved" : c.status === "unresolved",
          )
          .map((c) => (
            <section className="panel conflict-card" key={c.id}>
              <div className="conflict-title">
                <h2>{c.item}</h2>
                <span
                  className={
                    "badge " +
                    (c.status === "resolved" ? "resolved" : "conflict")
                  }
                >
                  {c.status === "resolved" ? "✓ Resolved" : "⚠ Price conflict"}
                </span>
              </div>
              <p>
                {c.carcass} · {c.shutter} · {c.finish}
              </p>
              <div className="conflict-prices">
                <div>
                  <small>VISIBLE MASTER LIST</small>
                  <strong>{currency(c.visible_price)}</strong>
                  {c.status === "unresolved" && (
                    <button
                      disabled={busy === c.id}
                      className="button secondary"
                      onClick={() => resolve(c, "master_list")}
                    >
                      Use {currency(c.visible_price)}
                    </button>
                  )}
                </div>
                <div>
                  <small>HIDDEN LOOKUP TABLE</small>
                  <strong>{currency(c.lookup_price)}</strong>
                  {c.status === "unresolved" && (
                    <button
                      disabled={busy === c.id}
                      className="button secondary"
                      onClick={() => resolve(c, "masterflat")}
                    >
                      Use {currency(c.lookup_price)}
                    </button>
                  )}
                </div>
              </div>
              {c.status === "resolved" ? (
                <div className="resolution">
                  <b>Official price: {currency(c.resolved_price)}</b>
                  <small>
                    Resolved by {c.resolved_by} on{" "}
                    {c.resolved_date
                      ? new Date(c.resolved_date).toLocaleString()
                      : ""}
                  </small>
                  <small>
                    Admin resolution:{" "}
                    {c.admin_resolution === "master_list"
                      ? "Visible Master List"
                      : "Hidden lookup table"}
                  </small>
                </div>
              ) : (
                <p className="summary-note">
                  Unavailable to Sales until Admin resolves this price.
                </p>
              )}
            </section>
          ))}
      </div>
      {records.length > 0 &&
        !records.some((c) =>
          resolved ? c.status === "resolved" : c.status === "unresolved",
        ) && (
          <div className="empty">
            {resolved
              ? "No resolved conflicts yet."
              : "All price conflicts have been resolved."}
          </div>
        )}
    </Shell>
  );
}
