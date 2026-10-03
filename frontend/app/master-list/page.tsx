"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { api, currency } from "@/lib/api";
import { Product, User, Area } from "@/lib/types";
const blank = {
  item: "",
  carcass: "-",
  shutter: "-",
  finish: "-",
  price: null,
  other: "0",
  hardware: "0",
  pricing_area: "0",
  active: true,
  specification: "",
  category: "",
  unit: "Sq Ft",
  measurement_mode: "area" as const,
  area_ids: [] as number[],
};
export default function MasterList() {
  const [user, setUser] = useState<User>();
  const [q, setQ] = useState("");
  const [item, setItem] = useState("");
  const [filter, setFilter] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [inactive, setInactive] = useState(false);
  const [data, setData] = useState<{ total: number; items: Product[] }>({
    total: 0,
    items: [],
  });
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Partial<Product> | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [areas, setAreas] = useState<Area[]>([]),
    [areaId, setAreaId] = useState("");
  const [history, setHistory] = useState<{
    prices: {
      old_price: string | null;
      new_price: string | null;
      reason: string;
      date: string;
      by: string;
    }[];
    sources: {
      sheet: string;
      row: number;
      file: string;
      price: string | null;
    }[];
  } | null>(null);
  useEffect(() => {
    api<Area[]>("/areas")
      .then(setAreas)
      .catch((e) => setError(e.message));
    api<User>("/auth/me")
      .then(setUser)
      .catch((e) => setError(e.message));
    api<Record<string, string[]>>("/master-list/filters")
      .then((f) => setFilter(f.item))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let live = true;
    const t = setTimeout(
      () =>
        api<typeof data>(
          `/master-list?q=${encodeURIComponent(q)}&item=${encodeURIComponent(item)}&offset=${offset}&include_inactive=${inactive}${areaId ? "&area_id=" + areaId : ""}`,
        )
          .then((d) => {
            if (live) setData(d);
          })
          .catch((e) => {
            if (live) setError(e.message);
          }),
      150,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, item, offset, inactive, refresh, areaId]);
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PRODUCTS & MATERIALS</span>
          <h1>Master List</h1>
          <p className="muted">
            Original workbook combinations and approved prices.
          </p>
        </div>
        {user?.role === "admin" && (
          <div className="actions">
            <Link
              href="/master-list/price-conflicts"
              className="button secondary"
            >
              Price conflicts
            </Link>
            <button className="button" onClick={() => setEdit(blank)}>
              + Add product
            </button>
          </div>
        )}
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <div className="toolbar">
        <select
          aria-label="Filter area"
          value={areaId}
          onChange={(e) => {
            setAreaId(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All areas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Search Master List"
          placeholder="Search item, carcass, shutter or finish…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
        <select
          aria-label="Filter item"
          value={item}
          onChange={(e) => {
            setItem(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All items</option>
          {filter.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
        {user?.role === "admin" && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={inactive}
              onChange={(e) => setInactive(e.target.checked)}
            />
            Include inactive
          </label>
        )}
      </div>
      <section className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Carcass</th>
                <th>Shutter</th>
                <th>Finish</th>
                <th>Specification / unit</th>
                <th className="numeric">Official price</th>
                <th>Status</th>
                {user?.role === "admin" && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.item}</b>
                    <small>
                      {p.source_row
                        ? "Excel row " + p.source_row
                        : "Added by Admin"}
                    </small>
                  </td>
                  <td>{p.carcass}</td>
                  <td>{p.shutter}</td>
                  <td>{p.finish}</td>
                  <td>
                    {p.specification}
                    <small>
                      {p.unit} · {p.source_sheet}
                    </small>
                  </td>
                  <td className="numeric">
                    {p.needs_review
                      ? "Awaiting resolution"
                      : p.price === null
                        ? "On Request"
                        : currency(p.price)}
                  </td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (p.needs_review
                          ? "conflict"
                          : p.active
                            ? "resolved"
                            : "draft")
                      }
                    >
                      {p.needs_review
                        ? "Price conflict"
                        : p.active
                          ? "Active"
                          : "Inactive"}
                    </span>
                  </td>
                  {user?.role === "admin" && (
                    <td>
                      <button
                        className="text-link"
                        onClick={() =>
                          api<typeof history>(`/master-list/${p.id}/history`)
                            .then(setHistory)
                            .catch((e) => setError(e.message))
                        }
                      >
                        Price history
                      </button>
                      {p.needs_review ? (
                        <Link
                          className="text-link"
                          href="/master-list/price-conflicts"
                        >
                          Resolve
                        </Link>
                      ) : (
                        <button
                          className="text-link"
                          onClick={() => setEdit(p)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>{data.total} combinations</span>
          <button disabled={!offset} onClick={() => setOffset(offset - 50)}>
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
      {edit && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit Master List product"
          >
            <div className="panel-heading">
              <h2>
                {edit.id ? "Edit combination" : "Add product combination"}
              </h2>
              <button
                onClick={() => setEdit(null)}
                aria-label="Close product edit"
                className="icon-button"
              >
                ×
              </button>
            </div>
            <form
              className="modal-body"
              onSubmit={async (e) => {
                e.preventDefault();
                const fields = Object.fromEntries(
                  [
                    "item",
                    "carcass",
                    "shutter",
                    "finish",
                    "price",
                    "other",
                    "hardware",
                    "pricing_area",
                    "active",
                    "specification",
                    "category",
                    "unit",
                    "measurement_mode",
                    "area_ids",
                  ].map((k) => [k, edit[k as keyof Product]]),
                );
                try {
                  await api(
                    edit.id ? `/master-list/${edit.id}` : "/master-list",
                    edit.id ? "PUT" : "POST",
                    fields,
                  );
                  setEdit(null);
                  setRefresh(refresh + 1);
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <div className="form-grid">
                <label className="description-field">
                  Full specification
                  <textarea
                    rows={3}
                    value={edit.specification || ""}
                    onChange={(e) =>
                      setEdit({ ...edit, specification: e.target.value })
                    }
                  />
                </label>
                <label>
                  Category
                  <input
                    value={edit.category || ""}
                    onChange={(e) =>
                      setEdit({ ...edit, category: e.target.value })
                    }
                  />
                </label>
                <label>
                  Unit
                  <input
                    value={edit.unit || "Sq Ft"}
                    onChange={(e) => setEdit({ ...edit, unit: e.target.value })}
                  />
                </label>
                <label>
                  Calculation
                  <select
                    value={edit.measurement_mode || "area"}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        measurement_mode: e.target
                          .value as Product["measurement_mode"],
                      })
                    }
                  >
                    <option value="area">
                      Width × length × quantity × rate
                    </option>
                    <option value="rft">Running feet × quantity × rate</option>
                    <option value="unit">Quantity × rate</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </label>
                {["item", "carcass", "shutter", "finish"].map((k) => (
                  <label key={k}>
                    {k}
                    <input
                      required
                      value={String(edit[k as keyof Product] || "")}
                      onChange={(e) =>
                        setEdit({ ...edit, [k]: e.target.value })
                      }
                    />
                  </label>
                ))}
                {["price", "other", "hardware", "pricing_area"].map((k) => (
                  <label key={k}>
                    {k === "price"
                      ? "Official price (blank = On Request)"
                      : k.replace("_", " ")}
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={String(edit[k as keyof Product] ?? "")}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          [k]: e.target.value || (k === "price" ? null : "0"),
                        })
                      }
                    />
                  </label>
                ))}
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={!!edit.active}
                    onChange={(e) =>
                      setEdit({ ...edit, active: e.target.checked })
                    }
                  />
                  Active
                </label>
              </div>
              <fieldset>
                <legend>Applicable areas</legend>
                {areas.map((a) => (
                  <label className="checkbox" key={a.id}>
                    <input
                      type="checkbox"
                      checked={edit.area_ids?.includes(a.id) || false}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          area_ids: e.target.checked
                            ? [...(edit.area_ids || []), a.id]
                            : (edit.area_ids || []).filter((id) => id !== a.id),
                        })
                      }
                    />
                    {a.name}
                  </label>
                ))}
              </fieldset>
              <p className="muted">
                The original imported values are retained. Changes are recorded
                in the audit log.
              </p>
              <button className="button" type="submit">
                Save product
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
              {error && <div className="error">{error}</div>}
            </form>
          </section>
        </div>
      )}
      {history && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Master price history"
          >
            <div className="panel-heading">
              <h2>Master price history</h2>
              <button
                className="icon-button"
                aria-label="Close price history"
                onClick={() => setHistory(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <table>
                <thead>
                  <tr>
                    <th>Date / by</th>
                    <th>Old rate</th>
                    <th>New rate</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {history.prices.map((h, n) => (
                    <tr key={n}>
                      <td>
                        {new Date(h.date).toLocaleString()}
                        <small>{h.by}</small>
                      </td>
                      <td>{currency(h.old_price)}</td>
                      <td>{currency(h.new_price)}</td>
                      <td>{h.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3>Original source values</h3>
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Row</th>
                    <th>Original rate</th>
                  </tr>
                </thead>
                <tbody>
                  {history.sources.map((s, n) => (
                    <tr key={n}>
                      <td>
                        {s.file}
                        <small>{s.sheet}</small>
                      </td>
                      <td>{s.row}</td>
                      <td>{currency(s.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}
