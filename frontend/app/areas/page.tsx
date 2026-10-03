"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api, currency } from "@/lib/api";
import { Area, Product } from "@/lib/types";
export default function Areas() {
  const [areas, setAreas] = useState<Area[]>([]),
    [selected, setSelected] = useState<number>();
  const [ids, setIds] = useState<number[]>([]),
    [products, setProducts] = useState<{ items: Product[]; total: number }>({
      items: [],
      total: 0,
    });
  const [q, setQ] = useState(""),
    [offset, setOffset] = useState(0),
    [error, setError] = useState(""),
    [note, setNote] = useState("");
  const [edit, setEdit] = useState<Partial<Area> | null>(null);
  const load = () =>
    api<Area[]>("/areas?include_inactive=true")
      .then(setAreas)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (selected)
      api<{ product_ids: number[] }>(`/areas/${selected}/products`)
        .then((d) => setIds(d.product_ids))
        .catch((e) => setError(e.message));
  }, [selected]);
  useEffect(() => {
    let live = true;
    const t = setTimeout(
      () =>
        api<typeof products>(
          `/master-list?q=${encodeURIComponent(q)}&limit=30&offset=${offset}`,
        )
          .then((d) => {
            if (live) setProducts(d);
          })
          .catch((e) => setError(e.message)),
      200,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, offset]);
  return (
    <Shell adminOnly>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CATALOGUE ORGANIZATION</span>
          <h1>Areas & products</h1>
          <p className="muted">
            Manage area names and applicable product specifications.
          </p>
        </div>
        <button
          className="button"
          onClick={() =>
            setEdit({ name: "", active: true, position: areas.length })
          }
        >
          + Add area
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {note && (
        <div className="success" role="status">
          {note}
        </div>
      )}
      <section className="panel form-panel">
        <div className="form-grid">
          <label>
            Area
            <select
              value={selected || ""}
              onChange={(e) => {
                setSelected(Number(e.target.value));
                setNote("");
              }}
            >
              <option value="">Select area</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {!a.active ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <button
              className="button secondary"
              onClick={() => setEdit(areas.find((a) => a.id === selected)!)}
            >
              Edit area
            </button>
          )}
          {selected && (
            <label>
              Copy products from another area
              <select
                defaultValue=""
                onChange={async (e) => {
                  if (!e.target.value) return;
                  try {
                    const d = await api<{ product_ids: number[] }>(
                      `/areas/${e.target.value}/products`,
                    );
                    setIds(d.product_ids);
                    setNote(
                      "Products copied into this form. Save assignments to apply.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <option value="">Choose a source area</option>
                {areas
                  .filter((a) => a.id !== selected)
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
      </section>
      {selected && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Applicable products · {ids.length} selected</h2>
            <button
              className="button"
              onClick={async () => {
                try {
                  await api(`/areas/${selected}/products`, "PUT", {
                    product_ids: ids,
                  });
                  setNote("Area product assignments saved.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Save assignments
            </button>
          </div>
          <div className="toolbar">
            <input
              aria-label="Search area products"
              placeholder="Search item or specification"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Assigned</th>
                  <th>Item</th>
                  <th>Specification</th>
                  <th>Master rate</th>
                </tr>
              </thead>
              <tbody>
                {products.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Assign ${p.item} ${p.specification}`}
                        checked={ids.includes(p.id)}
                        onChange={(e) =>
                          setIds(
                            e.target.checked
                              ? [...ids, p.id]
                              : ids.filter((i) => i !== p.id),
                          )
                        }
                      />
                    </td>
                    <td>{p.item}</td>
                    <td>
                      {p.specification ||
                        [p.carcass, p.shutter, p.finish].join(" + ")}
                    </td>
                    <td>
                      {p.needs_review ? "Price conflict" : currency(p.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>{products.total} products</span>
            <button disabled={!offset} onClick={() => setOffset(offset - 30)}>
              Previous
            </button>
            <button
              disabled={offset + 30 >= products.total}
              onClick={() => setOffset(offset + 30)}
            >
              Next
            </button>
          </div>
        </section>
      )}
      {edit && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Area details"
          >
            <div className="panel-heading">
              <h2>{edit.id ? "Edit area" : "New area"}</h2>
              <button
                className="icon-button"
                aria-label="Close area details"
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
                  const a = await api<Area>(
                    edit.id ? `/areas/${edit.id}` : "/areas",
                    edit.id ? "PUT" : "POST",
                    {
                      name: edit.name,
                      active: edit.active,
                      position: edit.position,
                    },
                  );
                  await load();
                  setSelected(a.id);
                  setEdit(null);
                  setNote("Area saved.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <label>
                Name
                <input
                  required
                  value={edit.name || ""}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </label>
              <label>
                Display order
                <input
                  type="number"
                  min="0"
                  value={edit.position || 0}
                  onChange={(e) =>
                    setEdit({ ...edit, position: Number(e.target.value) })
                  }
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={edit.active}
                  onChange={(e) =>
                    setEdit({ ...edit, active: e.target.checked })
                  }
                />
                Active
              </label>
              <button className="button">Save area</button>
              {error && <div className="error">{error}</div>}
            </form>
          </section>
        </div>
      )}
    </Shell>
  );
}
