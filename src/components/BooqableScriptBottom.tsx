import { useEffect } from "react";

const BOOQABLE_SCRIPT_SRC =
  "https://feeebb8b-2583-4689-b2f6-d488f8220b65.assets.booqable.com/v2/booqable.js";

function hasBooqableScript(): boolean {
  return Array.from(document.scripts).some((s) => s.src === BOOQABLE_SCRIPT_SRC);
}

/**
 * Ensures the Booqable script is present at the bottom of the checkout page.
 * This matches the user's requested <script src=".../booqable.js"></script>.
 */
export default function BooqableScriptBottom() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (hasBooqableScript()) return;

    const script = document.createElement("script");
    script.src = BOOQABLE_SCRIPT_SRC;
    script.async = true;
    script.dataset.origin = "checkout-bottom";
    document.body.appendChild(script);

    return () => {
      // Intentionally do not remove: the script is global and can be reused across views.
    };
  }, []);

  // No DOM output needed; we append the script to document.body.
  return null;
}
