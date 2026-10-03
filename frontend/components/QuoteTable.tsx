"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, FileDown, Sheet, ScanEye, FileText } from "lucide-react";
import { QuoteSummary } from "@/lib/types";
import {
  currency,
  downloadPdf,
  downloadExcel,
  generateQuotation,
} from "@/lib/api";
export default function QuoteTable({
  quotes,
  onError,
}: {
  quotes: QuoteSummary[];
  onError: (s: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  async function generate(id: number) {
    setBusy(id);
    try {
      const result = await generateQuotation(id);
      router.push(
        `/quotations/${id}/preview?revision=${result.revision}&generated=1`,
      );
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="table-scroll">
      <table className="quotation-table">
        <thead>
          <tr>
            <th>Quotation</th>
            <th>Customer / project</th>
            <th>Created by</th>
            <th>Date</th>
            <th className="numeric">Amount</th>
            <th>Status</th>
            <th>Version</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr key={q.id}>
              <td>
                <Link className="text-link" href={`/quotations/${q.id}`}>
                  {q.number}
                </Link>
              </td>
              <td>
                <b>{q.customer_name || "Untitled customer"}</b>
                <small>{q.project_reference || "Project pending"}</small>
              </td>
              <td>{q.created_by}</td>
              <td>{q.quote_date}</td>
              <td className="numeric">{currency(q.total)}</td>
              <td>
                <span className={`badge ${q.status}`}>{q.status}</span>
              </td>
              <td>
                <span className="version-tag">v{q.revision}</span>
              </td>
              <td>
                <div className="table-actions">
                  <Link
                    title="View quotation"
                    aria-label={`View ${q.number}`}
                    href={`/quotations/${q.id}`}
                  >
                    <Eye size={16} />
                  </Link>
                  <Link
                    title={
                      q.status === "draft" ? "Edit draft" : "Edit / new version"
                    }
                    aria-label={`Edit ${q.number}`}
                    href={`/quotations/${q.id}/edit`}
                  >
                    <Pencil size={16} />
                  </Link>
                  {q.status === "draft" ? (
                    <button
                      disabled={busy === q.id}
                      title="Generate quotation and preview"
                      aria-label={`Generate ${q.number}`}
                      onClick={() => generate(q.id)}
                    >
                      <FileText size={16} />
                      {busy === q.id ? "Saving…" : "Generate"}
                    </button>
                  ) : (
                    <>
                      <Link
                        title="Preview saved PDF"
                        aria-label={`Preview ${q.number}`}
                        href={`/quotations/${q.id}/preview`}
                      >
                        <ScanEye size={16} />
                      </Link>
                      <button
                        title="Download saved PDF"
                        aria-label={`Download PDF ${q.number}`}
                        onClick={() =>
                          downloadPdf(q.id).catch((e) => onError(e.message))
                        }
                      >
                        <FileDown size={16} />
                      </button>
                      <button
                        title="Download saved Excel"
                        aria-label={`Download Excel ${q.number}`}
                        onClick={() =>
                          downloadExcel(q.id).catch((e) => onError(e.message))
                        }
                      >
                        <Sheet size={16} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!quotes.length && (
        <div className="empty">
          <FileText size={28} />
          <strong>No quotations found</strong>
          <span className="muted">
            Try another filter or start a new project.
          </span>
          <Link className="button secondary" href="/quotations/new">
            Create quotation
          </Link>
        </div>
      )}
    </div>
  );
}
