import { useEffect } from "react";

declare global {
  interface Window {
    Booqable?: any;
    booqable?: any;
  }
}

const BOOQABLE_SCRIPT_ID = "booqable-script";
const BOOQABLE_SCRIPT_SRC =
  "https://feeebb8b-2583-4689-b2f6-d488f8220b65.assets.booqable.com/v2/booqable.js";

function getBooqableApi(): any {
  return window.Booqable || window.booqable;
}

function safeRefresh() {
  const api = getBooqableApi();
  if (!api) return;

  if (typeof api.refresh === "function") api.refresh();
  if (typeof api.trigger === "function") api.trigger("page-change");
}

/**
 * Loads the Booqable script once and re-scans the DOM when booqable buttons are added.
 * This avoids timing issues with React/accordion rendering.
 */
export function useBooqable() {
  useEffect(() => {
    const ensureScript = () => {
      const existing = document.getElementById(BOOQABLE_SCRIPT_ID) as
        | HTMLScriptElement
        | null;
      if (existing) return;

      const script = document.createElement("script");
      script.id = BOOQABLE_SCRIPT_ID;
      script.async = true;
      script.src = BOOQABLE_SCRIPT_SRC;
      script.onload = () => {
        // give the lib a moment to initialize
        setTimeout(() => {
          safeRefresh();
        }, 800);
      };
      script.onerror = () => {
        // eslint-disable-next-line no-console
        console.warn("Booqable script failed to load", BOOQABLE_SCRIPT_SRC);
      };
      // Prefer <head> for earlier loading and to avoid body-not-ready edge cases.
      (document.head || document.body).appendChild(script);
    };

    ensureScript();

    // Observe for dynamically rendered button placeholders.
    const observer = new MutationObserver(() => {
      const hasButtons = document.querySelector(".booqable-product-button");
      if (!hasButtons) return;

      const api = getBooqableApi();
      if (api?._defer) {
        api._defer(() => !!getBooqableApi(), () => safeRefresh());
        return;
      }

      // next tick + frame to ensure nodes are in DOM
      setTimeout(() => requestAnimationFrame(() => safeRefresh()), 0);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);
}
