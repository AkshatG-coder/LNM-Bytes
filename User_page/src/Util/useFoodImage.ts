// ─── Pexels food image hook ────────────────────────────────────────────────────
// Fetches a relevant food image from Pexels based on the menu item name.
// Results are cached in a module-level Map so repeated renders don't re-hit the API.

const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

const PEXELS_KEY = import.meta.env.VITE_PEXELS_API_KEY as string | undefined;

async function fetchPexelsImage(query: string): Promise<string> {
  if (!PEXELS_KEY) return "";

  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query + " food dish")}&per_page=1&orientation=landscape`,
    { headers: { Authorization: PEXELS_KEY } }
  );
  if (!res.ok) return "";
  const data = await res.json();
  return data?.photos?.[0]?.src?.medium ?? "";
}

import { useEffect, useState } from "react";

/**
 * Returns a Pexels image URL for the given food item name.
 * Falls back to "" if the API key is missing or the item has no match.
 */
export function useFoodImage(itemName: string): string {
  const [url, setUrl] = useState<string>(() => cache.get(itemName) ?? "");

  useEffect(() => {
    if (!itemName || !PEXELS_KEY) return;
    if (cache.has(itemName)) {
      setUrl(cache.get(itemName)!);
      return;
    }

    // Deduplicate concurrent requests for same item
    if (!inFlight.has(itemName)) {
      const promise = fetchPexelsImage(itemName).then((imgUrl) => {
        cache.set(itemName, imgUrl);
        inFlight.delete(itemName);
        return imgUrl;
      });
      inFlight.set(itemName, promise);
    }

    inFlight.get(itemName)!.then((imgUrl) => setUrl(imgUrl));
  }, [itemName]);

  return url;
}
