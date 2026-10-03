"use client";
import { Suspense, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import QuoteTable from "@/components/QuoteTable";
import { useSearchParams, useRouter } from "next/navigation";
import { api, currency } from "@/lib/api";
import { QuoteSummary } from "@/lib/types";
export default function QuotationsPage() {
  return (
    <Suspense fallback={<div className="loading">Loading quotations…</div>}>
      <Quotations />
    </Suspense>
  );
}
function Quotations() {
  const search = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(search.get("status") || "");
  useEffect(() => {
    setStatus(search.get("status") || "");
    setOffset(0);
  }, [search]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{
    items: QuoteSummary[];
    total: number;
    value?: string;
  }>({
    items: [],
    total: 0,
  });
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const t = setTimeout(
      () =>
        api<typeof data>(
          `/quotations?q=${encodeURIComponent(q)}&status=${status}&date_from=${from}&date_to=${to}&offset=${offset}`,
        )
          .then((d) => {
            if (live) setData(d);
          })
          .catch((e) => {
            if (live) setError(e.message);
          }),
      200,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, status, from, to, offset]);
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUOTATION HISTORY</span>
          <h1>Quotations</h1>
          <p className="muted">
            Search, continue a draft, or download a saved quotation.
          </p>
        </div>
      </div>
      <div className="toolbar">
        <input
          aria-label="Search quotations"
          placeholder="Search quotation, customer, project or date…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
        <select
          aria-label="Quotation status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            router.replace(
              e.target.value
                ? `/quotations?status=${e.target.value}`
                : "/quotations",
            );
            setOffset(0);
          }}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="generated">Generated</option>
          <option value="finalized">Finalized</option>
        </select>
        <input
          aria-label="From date"
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setOffset(0);
          }}
        />
        <input
          aria-label="To date"
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setOffset(0);
          }}
        />
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <div className="list-summary">
        <span>
          {data.total} {status || "total"} quotations
        </span>
        <strong>Quotation value {currency(data.value)}</strong>
      </div>
      <section className="panel">
        <QuoteTable quotes={data.items} onError={setError} />
        <div className="pagination">
          <span>{data.total} quotations</span>
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            Previous
          </button>
          <button
            disabled={offset + 50 >= data.total}
            onClick={() => setOffset(offset + 50)}
          >
            Next
          </button>
        </div>
      </section>
    </Shell>
  );
}
