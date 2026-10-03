import { QuoteInput, Line } from "./types";
export const currency = (value: string | number | undefined | null) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(Number(value));
export function cleanQuote(q: QuoteInput): QuoteInput {
  const keys = [
    "key",
    "product_id",
    "item_label",
    "description",
    "measurement_mode",
    "width",
    "length",
    "manual_area",
    "quantity",
    "other_description",
    "other_amount",
    "flat_charge",
    "quotation_rate",
    "override_reason",
    "custom",
    "custom_material",
    "custom_finish",
    "unit",
    "hardware_amount",
    "hardware_area",
    "carcass_rate",
  ] as const;
  return {
    customer_id: q.customer_id,
    customer_name: q.customer_name,
    address: q.address,
    phone: q.phone,
    email: q.email,
    project_reference: q.project_reference,
    quote_date: q.quote_date,
    revision: q.revision,
    sections: q.sections.map((s) => ({
      name: s.name,
      area_id: s.area_id,
      items: s.items.map(
        (i) => Object.fromEntries(keys.map((k) => [k, i[k]])) as Line,
      ),
    })),
  };
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Casa-Request": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let text = "The operation could not be completed.";
    try {
      const d = (await res.json()).detail;
      text =
        typeof d === "string"
          ? d
          : d?.issues
            ? d.issues.join("\n")
            : Array.isArray(d)
              ? d
                  .map(
                    (x: { loc: string[]; msg: string }) =>
                      `${x.loc.slice(1).join(".")}: ${x.msg}`,
                  )
                  .join("\n")
              : text;
    } catch {}
    throw new Error(text);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
export async function generateQuotation(id: number, body?: QuoteInput) {
  return api<{ id: number; revision: number }>(
    `/quotations/${id}/generate`,
    "POST",
    body ? cleanQuote(body) : undefined,
  );
}
export async function downloadPdf(
  id: number,
  generate = false,
  body?: QuoteInput,
  revision?: number,
): Promise<void> {
  if (generate) {
    const result = await generateQuotation(id, body);
    window.location.assign(
      `/quotations/${id}/preview?revision=${result.revision}&generated=1`,
    );
    return;
  }
  const res = await fetch(
    `/api/quotations/${id}/${generate ? "generate-pdf" : "pdf"}${revision ? `?revision=${revision}` : ""}`,
    {
      method: generate ? "POST" : "GET",
      headers: { "Content-Type": "application/json", "X-Casa-Request": "1" },
      credentials: "same-origin",
      body: body ? JSON.stringify(cleanQuote(body)) : undefined,
    },
  );
  if (!res.ok) {
    const d = (await res.json()).detail;
    throw new Error(
      typeof d === "string"
        ? d
        : d.issues?.join("\n") || "PDF generation failed.",
    );
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ||
    "quotation.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function downloadExcel(
  id: number,
  revision?: number,
): Promise<void> {
  const res = await fetch(
    `/api/quotations/${id}/excel${revision ? `?revision=${revision}` : ""}`,
    { credentials: "same-origin" },
  );
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.detail || "Excel download failed.");
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download =
    res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ||
    "quotation.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export const today = () => new Date().toLocaleDateString("en-CA");
export const emptyLine = (): Line => ({
  key: crypto.randomUUID(),
  product_id: null,
  item_label: "",
  description: "",
  measurement_mode: "area",
  width: null,
  length: null,
  manual_area: null,
  quantity: null,
  other_description: "",
  other_amount: "0",
  flat_charge: "0",
  quotation_rate: null,
  override_reason: "",
  custom: false,
});
