"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import {
  api,
  currency,
  downloadPdf,
  downloadExcel,
  generateQuotation,
} from "@/lib/api";
import { Quote, User } from "@/lib/types";
export default function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [q, setQ] = useState<Quote>();
  const [user, setUser] = useState<User>();
  const [versions, setVersions] = useState<
    {
      revision: number;
      total: string;
      created_at: string;
      has_excel: boolean;
      generated_by: string;
    }[]
  >([]);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    Promise.all([
      api<Quote>("/quotations/" + id),
      api<typeof versions>(`/quotations/${id}/versions`),
      api<User>("/auth/me"),
    ])
      .then(([q, v, user]) => {
        setQ(q);
        setVersions(v);
        setUser(user);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <Shell>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {q && (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">QUOTATION DETAILS</span>
              <h1>{q.number}</h1>
              <p className="muted">
                {q.customer_name} · {q.project_reference} · {q.quote_date} ·
                Created by {q.created_by}
              </p>
            </div>
            <div className="actions">
              {versions.length > 0 && (
                <Link
                  className="button secondary"
                  href={`/quotations/${id}/preview`}
                >
                  Preview quotation
                </Link>
              )}
              {user?.role === "admin" && q.status === "generated" && (
                <button
                  className="button secondary"
                  onClick={async () => {
                    try {
                      await api(`/quotations/${id}/finalize`, "POST");
                      setQ(await api<Quote>(`/quotations/${id}`));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Mark finalized
                </button>
              )}
              <Link
                className="button secondary"
                href={`/quotations/${id}/edit`}
              >
                Edit quotation
              </Link>
              <button
                className="button"
                onClick={async () => {
                  try {
                    if (q.status === "draft") {
                      const result = await generateQuotation(q.id);
                      router.push(
                        `/quotations/${q.id}/preview?revision=${result.revision}&generated=1`,
                      );
                    } else await downloadPdf(q.id);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {q.status !== "draft" ? "Download PDF" : "Generate quotation"}
              </button>
              {versions.some((v) => v.has_excel) && (
                <button
                  className="button secondary"
                  onClick={() =>
                    downloadExcel(q.id).catch((e) => setError(e.message))
                  }
                >
                  Download Excel
                </button>
              )}
              {versions.length > 0 && (
                <a
                  className="button secondary"
                  target="_blank"
                  rel="noopener"
                  href={`/api/quotations/${id}/pdf?inline=true`}
                >
                  Open / print PDF
                </a>
              )}
            </div>
          </div>
          {versions.length > 0 && (
            <div className="success" role="status">
              Quotation generated. Preview the saved PDF before choosing a
              download.
            </div>
          )}
          <div className="panel detail-panel">
            <div className="detail-customer">
              <div>
                <h2>{q.payload.customer_name}</h2>
                <p>{q.payload.address}</p>
                <p className="muted">
                  {q.payload.phone} {q.payload.email}
                </p>
              </div>
              <span className={"badge " + q.status}>{q.status}</span>
            </div>
            {q.payload.sections.map((s, n) => (
              <section key={n}>
                <h3 className="pdf-section-name">{s.name}</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Description</th>
                        <th>Measurements</th>
                        <th>Area / unit</th>
                        <th>Qty</th>
                        <th className="numeric">Rate</th>
                        <th className="numeric">Master rate</th>
                        <th className="numeric">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.items
                        .filter(
                          (i) => i.product_id || i.description || i.item_label,
                        )
                        .map((i) => (
                          <tr key={i.key}>
                            <td>{i.item_label || i.product?.item}</td>
                            <td>
                              {i.description}
                              {(Number(i.other_amount) > 0 ||
                                Number(i.flat_charge) > 0) && (
                                <small>
                                  {i.other_description}: rate addition{" "}
                                  {currency(i.other_amount)}, one-time{" "}
                                  {currency(i.flat_charge)}
                                </small>
                              )}
                              {i.issue && (
                                <small className="line-warning">
                                  {i.issue}
                                </small>
                              )}
                            </td>
                            <td>
                              {i.measurement_mode === "area"
                                ? `${i.width ?? "—"} × ${i.length ?? "—"} ft`
                                : i.measurement_mode === "rft"
                                  ? `${i.manual_area ?? "—"} Rft`
                                  : i.measurement_mode === "fixed"
                                    ? "Fixed charge"
                                    : "Per unit"}
                            </td>
                            <td>
                              {i.area || "—"}{" "}
                              {i.measurement_mode === "rft"
                                ? "Rft"
                                : i.measurement_mode === "unit"
                                  ? "unit"
                                  : "Sft"}
                            </td>
                            <td>{i.quantity || "—"}</td>
                            <td className="numeric">
                              {currency(i.final_rate || i.rate)}
                              {i.rate_override && (
                                <small>Override: {i.override_reason}</small>
                              )}
                            </td>
                            <td className="numeric">
                              {currency(
                                i.master_rate ?? (i.custom ? null : i.rate),
                              )}
                            </td>
                            <td className="numeric">{currency(i.amount)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="section-footer">
                  <span>Section total</span>
                  <b>{currency(s.total)}</b>
                </div>
              </section>
            ))}
            <div className="detail-totals">
              <p>
                Subtotal <b>{currency(q.payload.subtotal)}</b>
              </p>
              <p>
                GST {q.payload.gst_rate}% <b>{currency(q.payload.gst)}</b>
              </p>
              <h2>
                Total <b>{currency(q.payload.total)}</b>
              </h2>
              <p>{q.payload.amount_in_words}</p>
            </div>
            <h3>Terms & Conditions</h3>
            <ol className="terms-list">
              {q.payload.terms.map((t, n) => (
                <li key={n}>{t}</li>
              ))}
            </ol>
          </div>
          <section className="panel form-panel">
            <div className="panel-heading">
              <div>
                <h2>Saved document versions</h2>
                <p className="muted">
                  Each version retains its prices, terms, company details, PDF
                  and Excel.
                </p>
              </div>
              <button
                className="button secondary"
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Create a new quotation using current Master List prices and current terms? The existing quotation stays saved.",
                    )
                  )
                    return;
                  try {
                    const next = await api<Quote>(
                      `/quotations/${id}/new-version`,
                      "POST",
                    );
                    router.push(`/quotations/${next.id}/edit`);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                New quotation with current prices
              </button>
            </div>
            {versions.map((v) => (
              <div className="version-row" key={v.revision}>
                <span>
                  Version {v.revision} ·{" "}
                  {new Date(v.created_at).toLocaleString()} · Generated by{" "}
                  {v.generated_by}
                </span>
                <b>{currency(v.total)}</b>
                <Link
                  className="button secondary compact"
                  href={`/quotations/${id}/preview?revision=${v.revision}`}
                >
                  Preview
                </Link>
                <button
                  className="text-link"
                  onClick={() =>
                    downloadPdf(q.id, false, undefined, v.revision).catch((e) =>
                      setError(e.message),
                    )
                  }
                >
                  Download saved PDF
                </button>
                {v.has_excel && (
                  <button
                    className="text-link"
                    onClick={() =>
                      downloadExcel(q.id, v.revision).catch((e) =>
                        setError(e.message),
                      )
                    }
                  >
                    Download saved Excel
                  </button>
                )}
              </div>
            ))}
            {!versions.length && (
              <p className="muted">No PDF has been generated yet.</p>
            )}
          </section>
        </>
      )}
    </Shell>
  );
}
