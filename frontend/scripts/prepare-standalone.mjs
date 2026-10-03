import { cp, mkdir, access } from "node:fs/promises";
await mkdir("public", { recursive: true });
await cp(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "public/pdf.worker.min.mjs",
);
await mkdir(".next/standalone/.next", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
try {
  await access("public");
  await cp("public", ".next/standalone/public", { recursive: true });
} catch {}
