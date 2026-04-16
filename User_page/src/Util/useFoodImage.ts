// ─── Pexels food image hook ────────────────────────────────────────────────────
// Fetches a relevant food image from Pexels based on the menu item name.
// Results are cached in a module-level Map so repeated renders don't re-hit the API.

let initialCache: [string, string][] = [];
try {
  const stored = localStorage.getItem('PEXELS_IMAGE_CACHE');
  if (stored) initialCache = JSON.parse(stored);
} catch (e) {
  // ignore
}

const cache = new Map<string, string>(initialCache);
const inFlight = new Map<string, Promise<string>>();

function persistCache() {
  try {
    localStorage.setItem('PEXELS_IMAGE_CACHE', JSON.stringify(Array.from(cache.entries())));
  } catch (e) {}
}

const PEXELS_KEY = import.meta.env.VITE_PEXELS_API_KEY as string | undefined;

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80"; // Generic food placeholder

async function fetchPexelsImage(query: string): Promise<string> {
  if (!PEXELS_KEY) return FALLBACK_IMAGE;

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query + " food dish")}&per_page=1&orientation=landscape`,
      { headers: { Authorization: PEXELS_KEY } }
    );
    if (!res.ok) return FALLBACK_IMAGE;

    const data = await res.json();
    return data?.photos?.[0]?.src?.medium || FALLBACK_IMAGE;
  } catch (error) {
    console.error("Failed to fetch Pexels image:", error);
    return FALLBACK_IMAGE;
  }
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
      const promise = fetchPexelsImage(itemName)
        .then((imgUrl) => {
          cache.set(itemName, imgUrl);
          persistCache();
          inFlight.delete(itemName);
          return imgUrl;
        })
        .catch(() => {
          inFlight.delete(itemName);
          return FALLBACK_IMAGE;
        });
      inFlight.set(itemName, promise);
    }

    inFlight.get(itemName)!.then((imgUrl) => setUrl(imgUrl));
  }, [itemName]);

  return url;
}
