"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import Shell from "@/components/Shell";

import { api, currency } from "@/lib/api";

import { Customer } from "@/lib/types";

const blank = {
  name: "",

  address: "",

  phone: "",

  email: "",

  project_reference: "",

  notes: "",
};

export default function Customers() {
  const [offset, setOffset] = useState(0);

  const [q, setQ] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);

  const [error, setError] = useState("");

  const [edit, setEdit] = useState<Partial<Customer> | null>(null);

  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let live = true;

    api<Customer[]>(
      `/customers?q=${encodeURIComponent(q)}&offset=${offset}&limit=50`,
    )
      .then((c) => {
        if (live) setCustomers(c);
      })

      .catch((e) => setError(e.message));

    return () => {
      live = false;
    };
  }, [q, refresh, offset]);

  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CUSTOMER DIRECTORY</span>

          <h1>Customers</h1>

          <p className="muted">
            Customer and project details for your quotations.
          </p>
        </div>

        <button className="button" onClick={() => setEdit(blank)}>
          + Add customer
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="toolbar">
        <input
          aria-label="Search customers"

          placeholder="Search customer or project…"

          value={q}

          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
      </div>

      <section className="panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Customer</th>

              <th>Address</th>

              <th>Phone / email</th>

              <th>Project</th>

              <th>Quotations / projects</th>
              <th>Latest quotation</th>

              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link className="text-link" href={`/customers/${c.id}`}>
                    <b>{c.name}</b>
                  </Link>
                </td>

                <td>{c.address}</td>

                <td>
                  {c.phone}

                  <small>{c.email}</small>
                </td>

                <td>{c.project_reference}</td>

                <td>
                  {c.quotation_count || 0} quotations
                  <small>{c.project_count || 0} projects</small>
                </td>
                <td>
                  {c.latest_quotation || "—"}
                  <small>
                    {c.latest_amount
                      ? currency(c.latest_amount)
                      : "No quotations yet"}
                  </small>
                </td>

                <td>
                  <Link
                    className="button secondary compact"

                    href={`/customers/${c.id}`}
                  >
                    View details
                  </Link>

                  <button className="text-link" onClick={() => setEdit(c)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="pagination">
        <button
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          Previous
        </button>
        <span>Page {1 + offset / 50}</span>
        <button
          disabled={customers.length < 50}
          onClick={() => setOffset(offset + 50)}
        >
          Next
        </button>
      </div>

      {edit && (
        <div className="modal-backdrop">
          <section
            className="modal"

            role="dialog"

            aria-modal="true"

            aria-label="Customer details"
          >
            <div className="panel-heading">
              <h2>Customer details</h2>

              <button
                className="icon-button"

                aria-label="Close customer edit"

                onClick={() => setEdit(null)}
              >
                ×
              </button>
            </div>

            <form
              className="modal-body"

              onSubmit={async (e) => {
                e.preventDefault();

                try {
                  const fields = Object.fromEntries(
                    Object.keys(blank).map((k) => [
                      k,

                      edit[k as keyof Customer],
                    ]),
                  );

                  await api(
                    edit.id ? `/customers/${edit.id}` : "/customers",

                    edit.id ? "PUT" : "POST",

                    fields,
                  );

                  setEdit(null);

                  setRefresh(refresh + 1);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <div className="form-grid">
                {Object.keys(blank).map((k) => (
                  <label key={k}>
                    {k.replace("_", " ")}

                    <input
                      required={k === "name"}

                      type={k === "email" ? "email" : "text"}

                      value={String(edit[k as keyof Customer] || "")}

                      onChange={(e) =>
                        setEdit({ ...edit, [k]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>

              <button className="button">Save customer</button>

              {error && <div className="error">{error}</div>}
            </form>
          </section>
        </div>
      )}
    </Shell>
  );
}
