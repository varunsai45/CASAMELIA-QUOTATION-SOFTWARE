"use client";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { api, currency } from "@/lib/api";
import { Product } from "@/lib/types";
export default function ProductPicker({
  onSelect,
  onClose,
  areaId,
}: {
  onSelect: (p: Product) => void;
  onClose: () => void;
  areaId?: number | null;
}) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [data, setData] = useState<{ items: Product[]; total: number }>({
    items: [],
    total: 0,
  });
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Record<string, string[]>>(
      "/master-list/filters" + (areaId ? `?area_id=${areaId}` : ""),
    )
      .then(setFilters)
      .catch((e) => setError(e.message));
  }, [areaId]);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      const params = new URLSearchParams({
        ...selected,
        q,
        offset: String(offset),
        limit: "30",
        ...(areaId ? { area_id: String(areaId) } : {}),
      });
      api<typeof data>("/master-list?" + params)
        .then((d) => {
          if (live) setData(d);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, selected, offset, areaId]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-backdrop">
      <section
        className="modal product-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Select a product combination"
      >
        <div className="panel-heading">
          <div>
            <span className="eyebrow">MASTER LIST</span>
            <h2>Select a product combination</h2>
            <p className="muted">
              Rates come directly from the approved Master List.
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Close product selection"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="modal-body">
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Search products"
              placeholder="Search product, material or finish…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div className="filter-grid">
            {["item", "carcass", "shutter", "finish"].map((k) => (
              <select
                key={k}
                aria-label={`Filter ${k}`}
                value={selected[k] || ""}
                onChange={(e) => {
                  setSelected({ ...selected, [k]: e.target.value });
                  setOffset(0);
                }}
              >
                <option value="">All {k}</option>
                {filters[k]?.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            ))}
          </div>
          {error && <div className="error">{error}</div>}
          <div className="product-results">
            {data.items.map((p) => (
              <button
                className="product-result"
                key={p.id}
                disabled={p.needs_review}
                onClick={() => onSelect(p)}
              >
                <div>
                  <b>{p.item}</b>
                  <span>
                    {p.specification ||
                      [p.carcass, p.shutter, p.finish].join(" · ")}
                  </span>
                </div>
                <strong>
                  {p.needs_review
                    ? "Price conflict"
                    : p.price === null
                      ? "Enter project rate"
                      : currency(p.price)}
                </strong>
              </button>
            ))}
            {!data.items.length && (
              <div className="empty">
                No valid combinations match these filters.
              </div>
            )}
          </div>
          <div className="pagination">
            <span>{data.total} combinations</span>
            <button
              disabled={offset === 0}
              onClick={() => setOffset(offset - 30)}
            >
              Previous
            </button>
            <button
              disabled={offset + 30 >= data.total}
              onClick={() => setOffset(offset + 30)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
