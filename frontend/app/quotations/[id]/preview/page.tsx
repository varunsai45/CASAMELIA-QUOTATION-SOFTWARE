"use client";

import { use, useEffect, useState, Suspense } from "react";

import { useSearchParams } from "next/navigation";

import Link from "next/link";

import { ArrowLeft, Download, CheckCircle2, Pencil } from "lucide-react";

import Shell from "@/components/Shell";

import PdfViewer from "@/components/PdfViewer";

import { api, currency, downloadPdf, downloadExcel } from "@/lib/api";

import { Quote } from "@/lib/types";

type Version = {
  revision: number;

  total: string;

  created_at: string;

  has_excel: boolean;

  generated_by: string;

  customer_name: string;

  project_reference: string;
};

export default function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <Suspense fallback={<div className="loading">Opening preview…</div>}>
      <Preview id={id} />
    </Suspense>
  );
}

function Preview({ id }: { id: string }) {
  const search = useSearchParams();

  const requested = Number(search.get("revision")) || undefined;

  const [quote, setQuote] = useState<Quote>();

  const [version, setVersion] = useState<Version>();

  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<Quote>(`/quotations/${id}`),

      api<Version[]>(`/quotations/${id}/versions`),
    ])

      .then(([q, vs]) => {
        const v = requested ? vs.find((v) => v.revision === requested) : vs[0];

        if (!v)
          throw Error(
            "No saved PDF exists for this version. Generate the quotation first.",
          );

        setQuote(q);

        setVersion(v);
      })

      .catch((e) => setError(e.message));
  }, [id, requested]);

  return (
    <Shell>
      <Link href={`/quotations/${id}`} className="back-link">
        <ArrowLeft size={16} /> Back to quotation
      </Link>

      <div className="page-heading">
        <div>
          <span className="eyebrow">QUOTATION PREVIEW</span>

          <h1>{quote?.number || "Opening quotation"}</h1>

          <p className="muted">
            {version?.customer_name} · {version?.project_reference}
            {version && ` · Version ${version.revision}`}
          </p>
        </div>

        <div className="actions preview-actions">
          <Link className="button secondary" href={`/quotations/${id}/edit`}>
            <Pencil size={16} /> Edit quotation
          </Link>

          {version && (
            <>
              <button
                className="button"

                onClick={() =>
                  downloadPdf(
                    Number(id),

                    false,

                    undefined,

                    version.revision,
                  ).catch((e) => setError(e.message))
                }
              >
                <Download size={16} /> Download PDF
              </button>

              {version.has_excel && (
                <button
                  className="button secondary"

                  onClick={() =>
                    downloadExcel(Number(id), version.revision).catch((e) =>
                      setError(e.message),
                    )
                  }
                >
                  Download Excel
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {version && quote && (
        <>
          <div className="preview-summary">
            <CheckCircle2 size={22} />

            <div>
              <strong>
                {search.get("generated")
                  ? "Quotation generated"
                  : "Saved quotation version"}
              </strong>

              <small>
                Review customer details, items, rates, totals and terms before
                downloading.
              </small>
            </div>

            <b>{currency(version.total)}</b>

            <span className="badge generated">Generated</span>
          </div>

          <PdfViewer
            url={`/api/quotations/${id}/pdf?inline=true&revision=${version.revision}`}
          />

          <div className="preview-footer">
            <Link href={`/quotations/${id}`} className="button secondary">
              Close preview
            </Link>

            <Link href="/quotations" className="text-link">
              Back to quotations
            </Link>

            <a
              href={`/api/quotations/${id}/pdf?inline=true&revision=${version.revision}`}

              target="_blank"

              rel="noopener"

              className="text-link"
            >
              Open selectable PDF / print
            </a>
          </div>
        </>
      )}
    </Shell>
  );
}
