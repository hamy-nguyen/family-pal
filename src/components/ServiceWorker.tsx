"use client";

// Registers the service worker in production only (localhost dev doesn't need it
// and SW caching just gets in the way while developing). Requires a secure
// context — silently no-ops on plain-HTTP LAN, works on the Vercel HTTPS URL.
import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
