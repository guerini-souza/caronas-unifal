export type Coordinates = { lat: number; lng: number };

/**
 * Extrai latitude e longitude de um texto colado: "-21.7876, -46.5613" ou link do
 * Google Maps (".../@-21.7876,-46.5613,17z", "?query=-21.78%2C-46.56"). Exige casas decimais
 * com ponto para não confundir com números soltos, e recusa número truncado ("-121.78" não vira 21.78).
 */
export function parseCoordinates(text: string): Coordinates | null {
  let value = text.trim();
  if (!value) return null;
  try {
    value = decodeURIComponent(value);
  } catch {
    // texto com "%" solto: usa como veio
  }
  const m = value.match(/(?<![\d.\-])(-?\d{1,2}\.\d+)\s*[,;\s]\s*(?<![\d.\-])(-?\d{1,3}\.\d+)(?![\d.])/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  // O banco guarda 6 casas (~10 cm).
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

export function formatCoordinates(lat: number, lng: number) {
  return `${Math.round(lat * 1e6) / 1e6}, ${Math.round(lng * 1e6) / 1e6}`;
}

export function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
