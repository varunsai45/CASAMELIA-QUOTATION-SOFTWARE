export type User = {
  id: number;

  username: string;

  role: "admin" | "sales";

  active: boolean;
};

export type Product = {
  id: number;

  item: string;

  carcass: string;

  shutter: string;

  finish: string;

  price: string | null;

  other: string;

  hardware: string;

  pricing_area: string;

  active: boolean;

  needs_review: boolean;

  source_row: number | null;

  specification?: string;

  category?: string;

  unit?: string;

  measurement_mode?: "area" | "rft" | "unit" | "fixed";

  source_sheet?: string;

  area_ids?: number[];
};

export type Customer = {
  id: number;

  name: string;

  address: string;

  phone: string;

  email: string;

  project_reference: string;

  notes?: string;

  quotation_count?: number;

  project_count?: number;

  latest_quotation?: string | null;

  latest_amount?: string | null;
};

export type Line = {
  key: string;

  product_id: number | null;

  item_label: string;

  description: string;

  measurement_mode: "area" | "rft" | "unit" | "fixed";

  quotation_rate?: string | null;

  master_rate?: string | null;

  rate_override?: boolean;

  override_reason?: string | null;

  custom?: boolean;

  custom_material?: string;

  custom_finish?: string;

  unit?: string;

  hardware_amount?: string | null;

  hardware_area?: string | null;

  carcass_rate?: string | null;

  width: string | null;

  length: string | null;

  manual_area: string | null;

  quantity: string | null;

  other_description: string;

  other_amount: string;

  flat_charge: string;

  rate?: string | null;

  amount?: string | null;

  area?: string | null;

  final_rate?: string;

  issue?: string | null;

  product?: Pick<Product, "item" | "carcass" | "shutter" | "finish"> | null;
};

export type Area = {
  id: number;

  name: string;

  active: boolean;

  position: number;

  source_sheet: string;
};

export type Section = {
  name: string;

  area_id?: number | null;

  items: Line[];

  total?: string;
};

export type QuoteInput = {
  customer_id: number | null;

  customer_name: string;

  address: string;

  phone: string;

  email: string;

  project_reference: string;

  quote_date: string;

  revision?: number;

  sections: Section[];
};

export type QuoteData = QuoteInput & {
  number: string;

  revision: number;

  subtotal: string;

  gst_rate: string;

  gst: string;

  total: string;

  amount_in_words: string;

  issues: string[];

  terms: string[];

  company_text: string;
};

export type QuoteSummary = {
  id: number;

  number: string;

  customer_name: string;

  project_reference: string;

  quote_date: string;

  created_by: string;

  status: string;

  total: string;

  revision: number;
};

export type Quote = QuoteSummary & { payload: QuoteData };

export type Conflict = {
  id: number;

  product_id: number;

  item: string;

  carcass: string;

  shutter: string;

  finish: string;

  visible_price: string;

  lookup_price: string;

  status: string;

  admin_resolution: string | null;

  resolved_price: string | null;

  resolved_by: string | null;

  resolved_date: string | null;
};

export type Settings = {
  gst_rate: { rate: string };

  terms: { terms: string[] };

  company: { text: string; bank_details?: string; logo_base64?: string };

  numbering?: { prefix: string };

  october_import?: {
    product_count: number;

    conflicts: number;

    areas_imported: number;

    source_price_records: number;

    warnings: string[];
  };

  section_names: { names: string[] };

  source_import?: {
    product_count: number;

    issues: unknown[];

    duplicates: unknown[];
  };
};
