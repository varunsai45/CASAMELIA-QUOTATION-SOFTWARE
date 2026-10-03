"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Maximize,
  Scan,
} from "lucide-react";

export default function PdfViewer({ url }: { url: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState<number | null>(null);
  const [width, setWidth] = useState(800);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const renderTask = useRef<RenderTask | null>(null);
  useEffect(() => {
    let live = true;
    let destroy: (() => void) | undefined;
    setLoading(true);
    setError("");
    setPage(1);
    import("pdfjs-dist")
      .then((pdf) => {
        if (!live) return;
        pdf.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdf.getDocument({ url, withCredentials: true });
        destroy = () => {
          void task.destroy();
        };
        task.promise
          .then((d) => {
            if (live) setDoc(d);
          })
          .catch((e) => {
            if (live) {
              setError("The saved PDF could not be opened. " + e.message);
              setLoading(false);
            }
          });
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      live = false;
      renderTask.current?.cancel();
      destroy?.();
    };
  }, [url]);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, entry.contentRect.width - 48)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!doc) return;
    let live = true;
    let task: RenderTask | undefined;
    setLoading(true);
    doc
      .getPage(page)
      .then(async (p) => {
        if (!live || !canvas.current) return;
        const base = p.getViewport({ scale: 1 });
        const scale = zoom ?? width / base.width;
        const viewport = p.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;
        const c = canvas.current;
        c.width = Math.ceil(viewport.width * dpr);
        c.height = Math.ceil(viewport.height * dpr);
        c.style.width = viewport.width + "px";
        c.style.height = viewport.height + "px";
        task = p.render({
          canvas: c,
          viewport,
          transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
        });
        renderTask.current = task;
        await task.promise;
        if (live) setLoading(false);
      })
      .catch((e) => {
        if (live && e.name !== "RenderingCancelledException") {
          setError("Unable to display this PDF page.");
          setLoading(false);
        }
      });
    return () => {
      live = false;
      task?.cancel();
    };
  }, [doc, page, zoom, width]);
  return (
    <section className="pdf-viewer" aria-label="Saved PDF viewer">
      <div className="pdf-toolbar">
        <div className="actions">
          <button
            aria-label="Previous PDF page"
            disabled={!doc || page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span role="status">
            Page {page} / {doc?.numPages ?? "…"}
          </span>
          <button
            aria-label="Next PDF page"
            disabled={!doc || page === doc.numPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="actions">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom(Math.max(0.25, (zoom ?? 1) - 0.25))}
          >
            <Minus size={17} />
          </button>
          <span>{zoom ? Math.round(zoom * 100) + "%" : "Fit to width"}</span>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom(Math.min(3, (zoom ?? 1) + 0.25))}
          >
            <Plus size={17} />
          </button>
          <button
            title="Fit to width"
            aria-label="Fit PDF to width"
            onClick={() => setZoom(null)}
          >
            <Scan size={17} />
          </button>
          <button
            title="Full screen"
            aria-label="Full screen PDF"
            onClick={() => frame.current?.requestFullscreen()}
          >
            <Maximize size={17} />
          </button>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div ref={frame} className="pdf-canvas-frame" aria-busy={loading}>
        {loading && (
          <div className="pdf-loading" role="status">
            Loading saved PDF…
          </div>
        )}
        <canvas
          ref={canvas}
          aria-label={`Actual saved quotation PDF, page ${page}`}
          data-testid="pdf-canvas"
        />
      </div>
    </section>
  );
}
