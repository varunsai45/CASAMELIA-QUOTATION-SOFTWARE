"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import QuoteTable from "@/components/QuoteTable";
import { api } from "@/lib/api";
import { Customer, QuoteSummary } from "@/lib/types";
export default function CustomerDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<{
    customer: Customer;
    projects: string[];
    quotations: QuoteSummary[];
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<typeof data>(`/customers/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <Shell>
      <Link className="back-link" href="/customers">
        ← Back to customers
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CUSTOMER DETAILS</span>
          <h1>{data?.customer.name || "Customer"}</h1>
          <p className="muted">
            Customer information, projects and saved quotation documents.
          </p>
        </div>
        <Link className="button secondary" href="/quotations/new">
          New quotation
        </Link>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {data && (
        <>
          <div className="customer-detail-grid">
            <section className="panel form-panel">
              <h2>Customer information</h2>
              <dl className="info-grid">
                <dt>Name</dt>
                <dd>{data.customer.name}</dd>
                <dt>Phone</dt>
                <dd>{data.customer.phone || "—"}</dd>
                <dt>Email</dt>
                <dd>{data.customer.email || "—"}</dd>
                <dt>Address</dt>
                <dd>{data.customer.address || "—"}</dd>
              </dl>
            </section>
            <section className="panel form-panel">
              <h2>Projects</h2>
              {data.projects.length ? (
                data.projects.map((p) => (
                  <div className="project-row" key={p}>
                    {p}
                  </div>
                ))
              ) : (
                <p className="muted">No quotation projects yet.</p>
              )}
              {data.customer.notes && (
                <p className="muted">{data.customer.notes}</p>
              )}
            </section>
          </div>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Quotation history</h2>
                <p className="muted">
                  {data.quotations.length} quotations · Saved files open without
                  regeneration.
                </p>
              </div>
            </div>
            <QuoteTable quotes={data.quotations} onError={setError} />
          </section>
        </>
      )}
    </Shell>
  );
}
