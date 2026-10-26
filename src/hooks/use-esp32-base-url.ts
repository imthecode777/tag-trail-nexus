import { useEffect, useState } from "react";
import { BASE_URL_EVENT, DEFAULT_ESP32_BASE_URL, getEsp32BaseUrl } from "@/lib/esp32";

/**
 * Tracks the configured ESP32 base URL (default constant + localStorage
 * override edited from the navbar connection settings).
 */
export function useEsp32BaseUrl() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_ESP32_BASE_URL);

  useEffect(() => {
    const update = () => setBaseUrl(getEsp32BaseUrl());
    update();
    window.addEventListener(BASE_URL_EVENT, update);
    return () => window.removeEventListener(BASE_URL_EVENT, update);
  }, []);

  return baseUrl;
}
