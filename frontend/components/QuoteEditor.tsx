"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { Plus, Trash2, Save, Download, GripVertical } from "lucide-react";

import Shell from "./Shell";

import ProductPicker from "./ProductPicker";

import {
  api,
  cleanQuote,
  currency,
  generateQuotation,
  emptyLine,
  today,
} from "@/lib/api";

import {
  Customer,
  Line,
  Product,
  Quote,
  QuoteData,
  QuoteInput,
  Settings,
  Area,
} from "@/lib/types";

export default function QuoteEditor({ id }: { id?: number }) {
  const router = useRouter();

  const [qid, setQid] = useState(id);

  const [quote, setQuote] = useState<QuoteInput>({
    customer_id: null,

    customer_name: "",

    address: "",

    phone: "",

    email: "",

    project_reference: "",

    quote_date: today(),

    sections: [],
  });

  const [preview, setPreview] = useState<QuoteData>();

  const [settings, setSettings] = useState<Settings>();

  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const [rateEditing, setRateEditing] = useState<Record<string, boolean>>({});

  const [customerSearch, setCustomerSearch] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);

  const [areas, setAreas] = useState<Area[]>([]);

  const [picker, setPicker] = useState<{ s: number; i: number } | null>(null);

  const [error, setError] = useState("");

  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(false);

  const [loading, setLoading] = useState(!!id);

  const [dirty, setDirty] = useState(false);

  const [previewBusy, setPreviewBusy] = useState(false);

  const tick = useRef(0);

  useEffect(() => {
    Promise.all([api<Settings>("/settings"), api<Area[]>("/areas")])

      .then(([s, a]) => {
        setSettings(s);

        setAreas(a);
      })

      .catch((e) => setError(e.message));

    if (id)
      api<Quote>(`/quotations/${id}`)
        .then((q) => {
          setQuote(cleanQuote(q.payload));

          setPreview(q.payload);
        })

        .catch((e) => setError(e.message))

        .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      () =>
        api<Customer[]>(
          `/customers?q=${encodeURIComponent(customerSearch)}&limit=30`,
        )
          .then((c) => {
            if (live) setCustomers(c);
          })
          .catch((e) => {
            if (live) setError(e.message);
          }),
      200,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [customerSearch]);

  useEffect(() => {
    const n = ++tick.current;

    setPreviewBusy(true);

    const t = setTimeout(
      () =>
        api<QuoteData>(
          "/quotations/preview" + (qid ? `?quotation_id=${qid}` : ""),

          "POST",

          cleanQuote(quote),
        )
          .then((d) => {
            if (n === tick.current) {
              setPreview(d);

              setPreviewBusy(false);
            }
          })

          .catch((e) => {
            if (n === tick.current) {
              setError(e.message);

              setPreviewBusy(false);
            }
          }),

      300,
    );

    return () => clearTimeout(t);
  }, [quote, qid]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();

        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", h);

    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  function change(patch: Partial<QuoteInput>) {
    setQuote((q) => ({ ...q, ...patch }));

    setDirty(true);

    setNote("");
  }

  function line(s: number, i: number, patch: Partial<Line>) {
    if ("quotation_rate" in patch) {
      const master = preview?.sections[s]?.items[i]?.master_rate;

      if (
        master != null &&
        patch.quotation_rate != null &&
        Number(patch.quotation_rate) === Number(master)
      )
        patch.override_reason = null;

      patch.hardware_amount = null;

      patch.hardware_area = null;

      patch.carcass_rate = null;
    }

    const sections = quote.sections.map((x, n) =>
      n === s
        ? {
            ...x,

            items: x.items.map((l, j) => (j === i ? { ...l, ...patch } : l)),
          }
        : x,
    );

    change({ sections });
  }

  function sectionName(s: number, name: string) {
    change({
      sections: quote.sections.map((x, n) => (n === s ? { ...x, name } : x)),
    });
  }

  const closePicker = useCallback(() => setPicker(null), []);

  function selectProduct(p: Product) {
    if (!picker) return;

    line(picker.s, picker.i, {
      product_id: p.id,

      item_label: p.item,

      description:
        p.specification ||
        [p.carcass, p.shutter, p.finish].filter((v) => v !== "-").join(" + "),

      quotation_rate: null,

      override_reason: "",

      custom: false,

      measurement_mode: p.measurement_mode || "area",

      unit: p.unit,

      hardware_amount: null,

      hardware_area: null,

      carcass_rate: null,
    });

    setPicker(null);
  }

  async function customerSave() {
    if (!quote.customer_name.trim())
      return setError("Enter the customer name first.");

    try {
      const c = await api<Customer>("/customers", "POST", {
        name: quote.customer_name,

        address: quote.address,

        phone: quote.phone,

        email: quote.email,

        project_reference: quote.project_reference,
      });

      change({ customer_id: c.id });

      setCustomers([...customers, c]);

      setNote("Customer saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save(generate: boolean) {
    setBusy(true);

    setError("");

    setNote("");

    try {
      const input = cleanQuote(quote);

      if (generate) {
        const checked = await api<QuoteData>(
          "/quotations/preview" + (qid ? `?quotation_id=${qid}` : ""),

          "POST",

          input,
        );

        if (checked.issues.length) throw new Error(checked.issues.join("\n"));

        if (!input.customer_name || !input.address || !input.project_reference)
          throw new Error(
            "Enter customer name, address and project reference.",
          );
      }

      let current = qid;

      let body = input;

      if (!current || !generate) {
        const saved = await api<Quote>(
          current ? `/quotations/${current}` : "/quotations",

          current ? "PUT" : "POST",

          input,
        );

        current = saved.id;

        setQid(current);

        body = cleanQuote(saved.payload);

        setQuote(body);

        setPreview(saved.payload);

        setDirty(false);

        setNote(`Draft ${saved.number} saved.`);
      }

      if (generate) {
        const generated = await generateQuotation(current!, body);

        setDirty(false);

        router.push(
          `/quotations/${current}/preview?revision=${generated.revision}&generated=1`,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <Shell>
        <div className="loading">Loading quotation…</div>
      </Shell>
    );

  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUOTATION BUILDER</span>

          <h1>{preview?.number || "New quotation"}</h1>

          <p className="muted">
            Select materials. Add measurements. Generate your document.
          </p>
        </div>

        <span className="badge draft">
          {dirty ? "Unsaved changes" : "Draft"}
        </span>
      </div>

      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}

      {note && (
        <div role="status" className="success">
          {note}
        </div>
      )}

      <div className="editor-layout">
        <div className="editor-main">
          <section className="panel form-panel">
            <div className="panel-heading customer-heading">
              <h2>Customer & project</h2>

              <input
                className="customer-search"

                aria-label="Search existing customers"

                placeholder="Search customer…"

                value={customerSearch}

                onChange={(e) => setCustomerSearch(e.target.value)}
              />

              <button
                className="button secondary"

                onClick={() =>
                  change({
                    customer_id: null,

                    customer_name: "",

                    address: "",

                    phone: "",

                    email: "",
                  })
                }
              >
                + New customer
              </button>

              <select
                aria-label="Select existing customer"

                value={quote.customer_id || ""}

                onChange={(e) => {
                  const c = customers.find(
                    (c) => c.id === Number(e.target.value),
                  );

                  if (c)
                    change({
                      customer_id: c.id,

                      customer_name: c.name,

                      address: c.address,

                      phone: c.phone,

                      email: c.email,

                      project_reference: c.project_reference,
                    });
                  else change({ customer_id: null });
                }}
              >
                <option value="">New customer</option>

                {customers

                  .filter((c) =>
                    [c.name, c.phone, c.project_reference]

                      .join(" ")

                      .toLowerCase()

                      .includes(customerSearch.toLowerCase()),
                  )

                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-grid">
              <label>
                Customer name
                <input
                  value={quote.customer_name}

                  onChange={(e) => change({ customer_name: e.target.value })}
                />
              </label>

              <label>
                Project reference
                <input
                  value={quote.project_reference}

                  onChange={(e) =>
                    change({ project_reference: e.target.value })
                  }
                />
              </label>

              <label className="full-width">
                Address
                <textarea
                  rows={2}

                  value={quote.address}

                  onChange={(e) => change({ address: e.target.value })}
                />
              </label>

              <label>
                Phone
                <input
                  value={quote.phone}

                  onChange={(e) => change({ phone: e.target.value })}
                />
              </label>

              <label>
                Email
                <input
                  type="email"

                  value={quote.email}

                  onChange={(e) => change({ email: e.target.value })}
                />
              </label>

              <label>
                Date
                <input
                  type="date"

                  value={quote.quote_date}

                  onChange={(e) => change({ quote_date: e.target.value })}
                />
              </label>

              <div className="align-end">
                <button
                  className="button secondary small"

                  disabled={!!quote.customer_id}

                  onClick={customerSave}
                >
                  Save customer
                </button>
              </div>
            </div>
          </section>

          {quote.sections.map((s, si) => (
            <section className="panel section-panel" key={si}>
              <div className="section-heading">
                <GripVertical size={17} />

                <select
                  aria-label={`Section ${si + 1} catalogue area`}

                  value={s.area_id || ""}

                  onChange={(e) => {
                    const a = areas.find(
                      (a) => a.id === Number(e.target.value),
                    );

                    change({
                      sections: quote.sections.map((x, n) =>
                        n === si
                          ? {
                              ...x,

                              area_id: a?.id || null,

                              name: x.name || a?.name || "",
                            }
                          : x,
                      ),
                    });
                  }}
                >
                  <option value="">Select catalogue area</option>

                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>

                <input
                  aria-label={`Section ${si + 1} name`}

                  list="section-names"

                  placeholder="Area / section name"

                  value={s.name}

                  onChange={(e) => sectionName(si, e.target.value)}
                />

                <button
                  className="icon-button danger"

                  aria-label={`Remove section ${si + 1}`}

                  onClick={() =>
                    change({
                      sections: quote.sections.filter((_, n) => n !== si),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <button
                type="button"
                className="area-toggle"
                aria-expanded={!collapsed[si]}
                aria-controls={`area-content-${si}`}
                onClick={() =>
                  setCollapsed({ ...collapsed, [si]: !collapsed[si] })
                }
              >
                <span>
                  {s.name || "New area"} · {s.items.length} items
                </span>
                <strong>{currency(preview?.sections[si]?.total)}</strong>
                <span>{collapsed[si] ? "Expand" : "Collapse"}</span>
              </button>

              <div
                id={`area-content-${si}`}
                className="area-content"
                hidden={Boolean(collapsed[si])}
              >
                {s.items.map((i, ii) => {
                  const calc = preview?.sections[si]?.items[ii];

                  const master = calc?.master_rate;

                  const actualOverride =
                    i.quotation_rate != null
                      ? master == null ||
                        Number(i.quotation_rate) !== Number(master)
                      : Boolean(calc?.rate_override);

                  const editRate = Boolean(
                    rateEditing[i.key] ||
                    actualOverride ||
                    i.custom ||
                    (i.product_id && master == null),
                  );

                  return (
                    <div className="line-card" key={i.key}>
                      <div className="line-header">
                        <span className="line-no">{ii + 1}</span>

                        <button
                          className="select-product"

                          disabled={!s.area_id && !i.product_id && !i.custom}

                          onClick={() => setPicker({ s: si, i: ii })}
                        >
                          {i.custom
                            ? "Custom project item"
                            : calc?.product?.item ||
                              "Select product combination"}

                          <small>
                            {calc?.product
                              ? [
                                  calc.product.carcass,

                                  calc.product.shutter,

                                  calc.product.finish,
                                ].join(" · ")
                              : "Search the approved Master List"}
                          </small>
                        </button>

                        <div className="line-price">
                          <small>Master rate</small>

                          <b>
                            {currency(
                              calc?.master_rate ??
                                (i.custom ? null : calc?.rate),
                            )}
                          </b>
                        </div>

                        <button
                          className="icon-button danger"

                          aria-label={`Remove line ${ii + 1}`}

                          onClick={() =>
                            change({
                              sections: quote.sections.map((x, n) =>
                                n === si
                                  ? {
                                      ...x,

                                      items: x.items.filter((_, j) => j !== ii),
                                    }
                                  : x,
                              ),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="line-fields">
                        <label>
                          Item / display name
                          <input
                            value={i.item_label}

                            onChange={(e) =>
                              line(si, ii, { item_label: e.target.value })
                            }
                          />
                        </label>

                        <label className="description-field">
                          Description of work
                          <textarea
                            rows={2}

                            value={i.description}

                            onChange={(e) =>
                              line(si, ii, { description: e.target.value })
                            }
                          />
                        </label>
                      </div>

                      <div className="measurement-grid">
                        <label>
                          Quotation rate{" "}
                          {actualOverride && (
                            <span className="badge draft">Override</span>
                          )}
                          <input
                            aria-label={`Quotation rate line ${ii + 1}`}

                            readOnly={!editRate}

                            type="number"
                            inputMode="decimal"

                            min="0"

                            step="any"

                            value={i.quotation_rate ?? calc?.master_rate ?? ""}

                            onChange={(e) =>
                              line(si, ii, {
                                quotation_rate: e.target.value || null,
                              })
                            }
                          />
                          <button
                            type="button"

                            className="rate-toggle"

                            onClick={() => {
                              if (editRate) {
                                line(si, ii, {
                                  quotation_rate: master ?? null,

                                  override_reason: null,
                                });

                                setRateEditing({
                                  ...rateEditing,

                                  [i.key]: false,
                                });
                              } else
                                setRateEditing({
                                  ...rateEditing,
                                  [i.key]: true,
                                });
                            }}
                          >
                            {editRate && master != null
                              ? "Use master rate"
                              : "Change quotation rate"}
                          </button>
                        </label>

                        <label>
                          Measurement
                          <select
                            value={i.measurement_mode}

                            onChange={(e) =>
                              line(si, ii, {
                                measurement_mode: e.target
                                  .value as Line["measurement_mode"],
                              })
                            }
                          >
                            <option value="area">Square feet</option>

                            <option value="rft">Running feet</option>

                            <option value="unit">Per unit</option>

                            <option value="fixed">Fixed charge</option>
                          </select>
                        </label>

                        {i.measurement_mode === "area" ? (
                          <>
                            <label>
                              Width (ft)
                              <input
                                type="number"
                                inputMode="decimal"

                                min="0"

                                step="any"

                                value={i.width ?? ""}

                                onChange={(e) =>
                                  line(si, ii, {
                                    width: e.target.value || null,
                                  })
                                }
                              />
                            </label>

                            <label>
                              Length (ft)
                              <input
                                type="number"
                                inputMode="decimal"

                                min="0"

                                step="any"

                                value={i.length ?? ""}

                                onChange={(e) =>
                                  line(si, ii, {
                                    length: e.target.value || null,
                                  })
                                }
                              />
                            </label>
                          </>
                        ) : i.measurement_mode === "rft" ? (
                          <label>
                            Running feet
                            <input
                              type="number"
                              inputMode="decimal"

                              min="0"

                              step="any"

                              value={i.manual_area ?? ""}

                              onChange={(e) =>
                                line(si, ii, {
                                  manual_area: e.target.value || null,
                                })
                              }
                            />
                          </label>
                        ) : null}

                        <label>
                          Quantity
                          <input
                            type="number"
                            inputMode="decimal"

                            min="0"

                            step="any"

                            value={i.quantity ?? ""}

                            onChange={(e) =>
                              line(si, ii, { quantity: e.target.value || null })
                            }
                          />
                        </label>

                        <div className="calculated">
                          <small>
                            {i.measurement_mode === "rft" ? "Rft" : "Area"}
                          </small>

                          <b>{calc?.area ?? "—"}</b>
                        </div>

                        <div className="calculated">
                          <small>Amount</small>

                          <b>{currency(calc?.amount)}</b>
                        </div>
                      </div>

                      {actualOverride && (
                        <div className="line-fields override-fields">
                          <label className="description-field">
                            Override reason
                            <input
                              required

                              value={i.override_reason || ""}

                              onChange={(e) =>
                                line(si, ii, {
                                  override_reason: e.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                      )}

                      {i.custom && (
                        <div className="line-fields">
                          <label>
                            Material
                            <input
                              value={i.custom_material || ""}

                              onChange={(e) =>
                                line(si, ii, {
                                  custom_material: e.target.value,
                                })
                              }
                            />
                          </label>

                          <label>
                            Finish
                            <input
                              value={i.custom_finish || ""}

                              onChange={(e) =>
                                line(si, ii, { custom_finish: e.target.value })
                              }
                            />
                          </label>

                          <label>
                            Unit
                            <input
                              value={i.unit || ""}

                              onChange={(e) =>
                                line(si, ii, { unit: e.target.value })
                              }
                            />
                          </label>
                        </div>
                      )}

                      {(calc?.product?.item.toLowerCase().includes("sliding") ||
                        i.hardware_amount != null) && (
                        <details className="other-details">
                          <summary>
                            Sliding wardrobe hardware calculation
                          </summary>

                          <div className="other-grid">
                            {(
                              [
                                ["hardware_amount", "Hardware amount"],

                                [
                                  "hardware_area",
                                  "Hardware square feet divisor",
                                ],

                                ["carcass_rate", "Carcass rate"],
                              ] as const
                            ).map(([key, label]) => (
                              <label key={key}>
                                {label}

                                <input
                                  type="number"
                                  inputMode="decimal"

                                  min={key === "hardware_area" ? "0.0001" : "0"}

                                  step="any"

                                  value={i[key] ?? ""}

                                  onChange={(e) =>
                                    line(si, ii, {
                                      [key]: e.target.value || null,

                                      override_reason:
                                        i.override_reason ||
                                        "Project-specific carcass and hardware calculation",
                                    })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        </details>
                      )}

                      <details
                        className="other-details"

                        open={
                          !!Number(i.other_amount) || !!Number(i.flat_charge)
                        }
                      >
                        <summary>Additional charges</summary>

                        <div className="other-grid">
                          <label>
                            Other description
                            <input
                              value={i.other_description}

                              onChange={(e) =>
                                line(si, ii, {
                                  other_description: e.target.value,
                                })
                              }
                            />
                          </label>

                          <label>
                            Rate addition (₹ per Sft / Rft / unit)
                            <input
                              type="number"
                              inputMode="decimal"

                              min="0"

                              step="0.01"

                              value={i.other_amount}

                              onChange={(e) =>
                                line(si, ii, {
                                  other_amount: e.target.value || "0",
                                })
                              }
                            />
                          </label>

                          <label>
                            One-time charge (₹)
                            <input
                              type="number"
                              inputMode="decimal"

                              min="0"

                              step="0.01"

                              value={i.flat_charge}

                              onChange={(e) =>
                                line(si, ii, {
                                  flat_charge: e.target.value || "0",
                                })
                              }
                            />
                          </label>
                        </div>
                      </details>

                      {calc?.issue && (
                        <p className="line-warning">{calc.issue}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                className="section-footer"
                onClick={() => setCollapsed({ ...collapsed, [si]: false })}
              >
                <button
                  className="button secondary small"

                  onClick={() =>
                    change({
                      sections: quote.sections.map((x, n) =>
                        n === si
                          ? { ...x, items: [...x.items, emptyLine()] }
                          : x,
                      ),
                    })
                  }
                >
                  <Plus size={15} /> Add item
                </button>

                <button
                  className="button secondary small"

                  onClick={() =>
                    change({
                      sections: quote.sections.map((x, n) =>
                        n === si
                          ? {
                              ...x,

                              items: [
                                ...x.items,

                                {
                                  ...emptyLine(),

                                  custom: true,

                                  override_reason:
                                    "Project-specific custom item",
                                },
                              ],
                            }
                          : x,
                      ),
                    })
                  }
                >
                  + Custom item
                </button>

                <span>
                  Section total <b>{currency(preview?.sections[si]?.total)}</b>
                </span>
              </div>
            </section>
          ))}

          <button
            className="add-section"

            onClick={() =>
              change({ sections: [...quote.sections, { name: "", items: [] }] })
            }
          >
            <Plus size={18} /> Add area / section
          </button>

          <datalist id="section-names">
            {settings?.section_names.names.map((n) => (
              <option value={n} key={n} />
            ))}
          </datalist>
        </div>

        <aside className="quotation-summary panel">
          <span className="eyebrow">QUOTATION SUMMARY</span>

          <h2>Your project total</h2>

          <div className="summary-row">
            <span>Subtotal</span>

            <b>{currency(preview?.subtotal)}</b>
          </div>

          <div className="summary-row">
            <span>
              GST {preview?.gst_rate || settings?.gst_rate.rate || "18"}%
            </span>

            <b>{currency(preview?.gst)}</b>
          </div>

          <div className="grand-total">
            <small>Grand total</small>

            <strong>{currency(preview?.total)}</strong>
          </div>

          <p className="amount-words">{preview?.amount_in_words}</p>

          {previewBusy && <small role="status">Calculating…</small>}

          <button
            className="button secondary"

            disabled={busy}

            onClick={() => save(false)}
          >
            <Save size={16} /> SAVE DRAFT
          </button>

          <button
            className="button"

            disabled={busy || previewBusy}

            onClick={() => save(true)}
          >
            <Download size={16} />

            {busy ? "Working…" : "GENERATE QUOTATION"}
          </button>

          <p className="summary-note">
            Saves PDF and editable Excel as an immutable version, then opens
            preview. Review the quotation before choosing a download.
          </p>

          <details>
            <summary>Terms & Conditions</summary>

            <ol>
              {(preview?.terms || settings?.terms.terms)?.map((t, n) => (
                <li key={n}>{t}</li>
              ))}
            </ol>
          </details>
        </aside>
      </div>

      <div className="mobile-editor-bar">
        <div>
          <small>Total incl. GST</small>
          <strong>{currency(preview?.total)}</strong>
        </div>
        <button
          className="button secondary"
          aria-label="SAVE DRAFT"
          disabled={busy}
          onClick={() => save(false)}
        >
          <Save size={20} />
        </button>
        <button
          className="button"
          aria-label="GENERATE QUOTATION"
          disabled={busy || previewBusy}
          onClick={() => save(true)}
        >
          {busy ? "Saving…" : "Generate"}
        </button>
      </div>

      {picker && (
        <ProductPicker
          areaId={quote.sections[picker.s].area_id}

          onSelect={selectProduct}

          onClose={closePicker}
        />
      )}
    </Shell>
  );
}
