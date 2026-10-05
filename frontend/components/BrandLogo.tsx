"use client";

import { useEffect, useRef, useState } from "react";

export default function BrandLogo() {
  const [useBundledLogo, setUseBundledLogo] = useState(false);
  const image = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // An SSR image can fail before React attaches its error handler.
    if (image.current?.complete && image.current.naturalWidth === 0)
      setUseBundledLogo(true);
  }, []);

  return (
    <img
      ref={image}
      src={useBundledLogo ? "/app-logo.png" : "/api/branding/logo"}
      alt="Casamelia International"
      onError={() => setUseBundledLogo(true)}
    />
  );
}
