"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
import { Settings, User } from "@/lib/types";
type Audit = {
  id: number;
  actor: string;
  action: string;
  entity: string;
  date: string;
  before: unknown;
  after: unknown;
};
export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>();
  const [users, setUsers] = useState<User[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [gst, setGst] = useState("18");
  const [terms, setTerms] = useState<string[]>([]);
  const [company, setCompany] = useState({
    text: "",
    bank_details: "",
    logo_base64: "",
  });
  const [prefix, setPrefix] = useState("CASA");
  const load = () =>
    Promise.all([
      api<Settings>("/settings"),
      api<User[]>("/users"),
      api<Audit[]>("/audit-log"),
    ])
      .then(([s, u, a]) => {
        setSettings(s);
        setUsers(u);
        setAudit(a);
        setGst(s.gst_rate.rate);
        setTerms(s.terms.terms);
        setCompany({
          text: s.company.text,
          bank_details: s.company.bank_details || "",
          logo_base64: s.company.logo_base64 || "",
        });
        setPrefix(s.numbering?.prefix || "CASA");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  async function action(
    path: string,
    method: string,
    body: unknown,
    msg: string,
  ) {
    setError("");
    try {
      await api(path, method, body);
      setNotice(msg);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Shell adminOnly>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>Admin settings</h1>
          <p className="muted">
            Manage access, tax settings and quotation terms.
          </p>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="success" role="status">
          {notice}
        </div>
      )}
      <section className="panel form-panel">
        <h2>Company, bank details & logo</h2>
        <p className="muted">
          New quotations use these details. Saved versions retain their original
          settings.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            action(
              "/settings/company",
              "PUT",
              company,
              "Company settings saved for new quotations.",
            );
          }}
        >
          <label>
            Company header
            <textarea
              rows={8}
              required
              value={company.text}
              onChange={(e) => setCompany({ ...company, text: e.target.value })}
            />
          </label>
          <label>
            Bank details
            <textarea
              rows={5}
              value={company.bank_details}
              onChange={(e) =>
                setCompany({ ...company, bank_details: e.target.value })
              }
              placeholder="Enter the company's approved beneficiary, bank, branch, account and IFSC details"
            />
          </label>
          <label>
            Logo (PNG or JPEG)
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 1_000_000) {
                  setError("Logo must be under 1 MB.");
                  return;
                }
                const r = new FileReader();
                r.onload = () =>
                  setCompany({
                    ...company,
                    logo_base64: String(r.result).split(",")[1],
                  });
                r.readAsDataURL(f);
              }}
            />
          </label>
          <button className="button">Save company settings</button>
        </form>
      </section>
      <section className="panel form-panel">
        <h2>Quotation numbering</h2>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            action(
              "/settings/numbering",
              "PUT",
              { prefix },
              "Numbering prefix saved for new quotations.",
            );
          }}
        >
          <label>
            Prefix
            <input
              required
              pattern="[A-Z0-9]+"
              maxLength={12}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            />
          </label>
          <button className="button">Save prefix</button>
        </form>
      </section>
      {settings?.october_import && (
        <section className="panel form-panel">
          <h2>October source import</h2>
          <p>
            {settings.october_import.product_count} specifications ·{" "}
            {settings.october_import.areas_imported} areas ·{" "}
            {settings.october_import.conflicts} conflicts ·{" "}
            {settings.october_import.source_price_records} source price records
          </p>
          <ul>
            {settings.october_import.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="panel form-panel">
        <h2>GST configuration</h2>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            action(
              "/settings/gst",
              "PUT",
              { gst_rate: gst },
              "GST updated for new quotations.",
            );
          }}
        >
          <label>
            GST rate (%)
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              value={gst}
              onChange={(e) => setGst(e.target.value)}
            />
          </label>
          <button className="button">Save GST</button>
        </form>
      </section>
      <section className="panel form-panel">
        <h2>Terms & Conditions</h2>
        <p className="muted">
          Imported wording is preserved. Changes apply to new generated
          quotations; saved versions retain their original terms.
        </p>
        {terms.map((t, n) => (
          <label key={n}>
            Term {n + 1}
            <textarea
              rows={3}
              value={t}
              onChange={(e) =>
                setTerms(terms.map((v, i) => (i === n ? e.target.value : v)))
              }
            />
          </label>
        ))}
        <button
          className="button secondary"
          onClick={() => setTerms([...terms, ""])}
        >
          Add term
        </button>
        <button
          className="button"
          onClick={() =>
            action("/settings/terms", "PUT", { terms }, "Terms saved.")
          }
        >
          Save terms
        </button>
      </section>
      <section className="panel form-panel">
        <h2>User access</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.role}</td>
                  <td>{u.active ? "Active" : "Inactive"}</td>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => {
                        const password = window.prompt(
                          "Enter a new password (at least 8 characters):",
                        );
                        if (password)
                          action(
                            `/users/${u.id}`,
                            "PUT",
                            { password },
                            "Password changed. Existing sessions were revoked.",
                          );
                      }}
                    >
                      Change password
                    </button>{" "}
                    <button
                      className="text-link"
                      onClick={() =>
                        action(
                          `/users/${u.id}`,
                          "PUT",
                          { active: !u.active },
                          "User access updated.",
                        )
                      }
                    >
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action(
              "/users",
              "POST",
              {
                username: f.get("username"),
                password: f.get("password"),
                role: f.get("role"),
              },
              "User created.",
            );
            e.currentTarget.reset();
          }}
        >
          <label>
            Username
            <input name="username" minLength={3} required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label>
            Role
            <select name="role">
              <option value="sales">Sales Executive</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button className="button">Create user</button>
        </form>
      </section>
      <section className="panel form-panel">
        <h2>Workbook import</h2>
        <p>
          {settings?.source_import?.product_count} original combinations
          imported. Both prices are retained for conflicts.
        </p>
        <details>
          <summary>Import issues and source details</summary>
          <pre>{JSON.stringify(settings?.source_import, null, 2)}</pre>
        </details>
      </section>
      <section className="panel form-panel">
        <h2>Audit log</h2>
        {audit.map((a) => (
          <details key={a.id} className="audit-row">
            <summary>
              {a.date} · {a.actor} · {a.action.replaceAll("_", " ")} ·{" "}
              {a.entity}
            </summary>
            <pre>
              {JSON.stringify({ before: a.before, after: a.after }, null, 2)}
            </pre>
          </details>
        ))}
      </section>
    </Shell>
  );
}
