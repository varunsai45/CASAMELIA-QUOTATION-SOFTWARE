"use client";
import { useEffect, useState } from "react";
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt>();
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    const ready = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const installed = () => setPrompt(undefined);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  if (!prompt) return null;
  return (
    <button
      className="install-app"
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice;
        setPrompt(undefined);
      }}
    >
      Install Casamelia app
    </button>
  );
}
