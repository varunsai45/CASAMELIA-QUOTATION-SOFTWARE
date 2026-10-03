"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Clock, CheckCircle2, ArrowUpRight } from "lucide-react";
import Shell from "@/components/Shell";
import QuoteTable from "@/components/QuoteTable";
import { api, currency } from "@/lib/api";
import { QuoteSummary, User } from "@/lib/types";
type Dashboard = {
  total: number;
  drafts: number;
  generated: number;
  value: string;
  recent: QuoteSummary[];
  customers: number;
  master_products: number;
  price_conflicts: number | null;
};
export default function Dashboard() {
  const [data, setData] = useState<Dashboard>();
  const [user, setUser] = useState<User>();
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api<Dashboard>("/dashboard"), api<User>("/auth/me")])
      .then(([d, u]) => {
        setData(d);
        setUser(u);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OVERVIEW</span>
          <h1>Quotation dashboard</h1>
          <p className="muted">
            {user?.role === "sales"
              ? "Your projects, drafts and generated quotations."
              : "A clear view of every project quotation."}
          </p>
        </div>
        <Link className="button" href="/quotations/new">
          Create quotation <ArrowUpRight size={17} />
        </Link>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="stats">
        {[
          [
            user?.role === "sales" ? "My quotations" : "Total quotations",
            data?.total,
            FileText,
          ],
          ["Draft quotations", data?.drafts, Clock],
          ["Generated quotations", data?.generated, CheckCircle2],
          [
            "Total quotation value",
            data ? currency(data.value) : "—",
            ArrowUpRight,
          ],
        ].map(([label, val, Icon], n) => {
          const I = Icon as typeof FileText;
          return (
            <Link
              className="stat stat-link"
              key={n}
              href={
                n === 1
                  ? "/quotations?status=draft"
                  : n === 2
                    ? "/quotations?status=generated"
                    : "/quotations"
              }
            >
              <div>
                <span>{String(label)}</span>
                <I size={19} />
              </div>
              <strong>{val === undefined ? "—" : String(val)}</strong>
              <small>
                {n === 3 ? "Including GST" : "Across your workspace"}
              </small>
              <ArrowUpRight className="stat-arrow" size={18} />
            </Link>
          );
        })}
      </div>
      {user?.role === "admin" && (
        <div className="stats">
          {[
            ["Customers", data?.customers],
            ["Master List items", data?.master_products],
            ["Unresolved price conflicts", data?.price_conflicts],
          ].map(([label, value], n) => (
            <Link
              className="stat stat-link"
              key={label}
              href={
                [
                  "/customers",
                  "/master-list",
                  "/price-conflicts?status=unresolved",
                ][n]
              }
            >
              <span>{label}</span>
              <strong>{value ?? "—"}</strong>
              <small>
                {
                  [
                    "Customer directory",
                    "Active catalogue selections",
                    "Awaiting Admin review",
                  ][n]
                }
              </small>
              <ArrowUpRight className="stat-arrow" size={18} />
            </Link>
          ))}
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Recent quotations</h2>
            <p className="muted">Pick up where you left off.</p>
          </div>
          <Link href="/quotations" className="text-link">
            View all →
          </Link>
        </div>
        <QuoteTable quotes={data?.recent || []} onError={setError} />
      </section>
      <div className="dashboard-note">
        <div>
          <span className="eyebrow">FROM SELECTION TO DOCUMENT</span>
          <h2>Prepare a quotation with confidence.</h2>
          <p>
            Choose a material combination, add measurements, and generate your
            Casamelia PDF.
          </p>
        </div>
        <Link href="/master-list" className="button secondary">
          Browse Master List
        </Link>
      </div>
    </Shell>
  );
}
