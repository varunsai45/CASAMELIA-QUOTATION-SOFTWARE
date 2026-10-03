import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Casamelia Quotation Software",
    short_name: "Casamelia",
    description: "Casamelia International quotation workspace",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8f5",
    theme_color: "#515c44",
    icons: [
      {
        src: "/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/app-icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
