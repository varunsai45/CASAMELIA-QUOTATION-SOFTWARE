"use client";
import { useEffect } from "react";
/** Use the same semantic table and data on all devices; mobile CSS presents rows as cards. */
export default function ResponsiveTables() {
  useEffect(() => {
    const label = () =>
      document.querySelectorAll("table").forEach((table) => {
        const headings = Array.from(table.querySelectorAll("thead th")).map(
          (h) => h.textContent || "",
        );
        table.querySelectorAll("tbody tr").forEach((row) =>
          Array.from(row.children).forEach((cell, index) => {
            if (cell.tagName === "TD")
              cell.setAttribute("data-label", headings[index] || "");
          }),
        );
      });
    label();
    const observer = new MutationObserver(label);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
