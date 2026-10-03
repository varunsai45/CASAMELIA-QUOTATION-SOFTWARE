"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
type Report = Record<string, unknown[]>;
type Batch = {
  id: number;
  filename: string;
  status: string;
  date: string;
  report: Report;
};
export default function Imports() {
  const [batches, setBatches] = useState<Batch[]>([]),
    [preview, setPreview] = useState<{
      id: number;
      report: Report;
      status: string;
    }>(),
    [file, setFile] = useState<File>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState("");
  const load = () =>
    api<Batch[]>("/imports")
      .then(setBatches)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  async function inspect() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 5_000_000)
        throw new Error("Select a workbook under 5 MB.");
      const content = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      setPreview(
        await api("/imports/preview", "POST", {
          filename: file.name,
          content_base64: content,
        }),
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell adminOnly>
      <div className="page-heading">
        <div>
          <span className="eyebrow">REVIEWED CATALOGUE UPDATES</span>
          <h1>Master List Excel imports</h1>
          <p className="muted">
            Review changes before applying them. Original source values and
            import history are retained.
          </p>
        </div>
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
        <label>
          Revised Master List workbook
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0]);
              setPreview(undefined);
            }}
          />
        </label>
        <p className="muted">
          Use the October workbook format: Item, Specification, Price. This
          import reviews Master List changes; manage area assignments and
          area-only specifications in the Admin catalogue.
        </p>
        <button className="button" disabled={!file || busy} onClick={inspect}>
          {busy ? "Inspecting…" : "Preview import"}
        </button>
      </section>
      {preview && (
        <section className="panel form-panel">
          <h2>Import preview #{preview.id}</h2>
          {Object.entries(preview.report).map(([key, rows]) => (
            <details
              key={key}
              open={
                key === "conflicts" ||
                key === "price_changes" ||
                key === "warnings"
              }
            >
              <summary>
                {key.replaceAll("_", " ")} ({rows.length})
              </summary>
              <div className="table-scroll">
                <table>
                  <tbody>
                    {rows.map((row, n) => (
                      <tr key={n}>
                        <td>
                          {typeof row === "string"
                            ? row
                            : Object.entries(row as Record<string, unknown>)
                                .filter(
                                  ([k]) =>
                                    ![
                                      "expected_price",
                                      "formula",
                                      "key",
                                    ].includes(k),
                                )
                                .map(
                                  ([k, v]) =>
                                    `${k.replaceAll("_", " ")}: ${v ?? "unpriced"}`,
                                )
                                .join(" · ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
          <button
            className="button"
            disabled={
              busy ||
              preview.status !== "preview" ||
              !!preview.report.duplicates?.length
            }
            onClick={async () => {
              if (
                !window.confirm(
                  "Apply the reviewed Master List changes and deactivate the listed removed items? Unresolved conflicting prices will require Admin resolution.",
                )
              )
                return;
              setBusy(true);
              try {
                await api(`/imports/${preview.id}/apply`, "POST");
                setPreview({ ...preview, status: "applied" });
                setNote(
                  "Reviewed import applied. Conflicting prices remain blocked until resolved.",
                );
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirm and apply import
          </button>
        </section>
      )}
      <section className="panel table-scroll">
        <div className="panel-heading">
          <h2>Import history</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Import</th>
              <th>File</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>#{b.id}</td>
                <td>{b.filename}</td>
                <td>{new Date(b.date).toLocaleString()}</td>
                <td>{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
