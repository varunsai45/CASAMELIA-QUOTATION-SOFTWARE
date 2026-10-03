import { mkdir, cp } from "node:fs/promises";
await mkdir("public", { recursive: true });
await cp(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "public/pdf.worker.min.mjs",
);
