import { createHash, randomBytes, createHmac } from "crypto";

export function newServerSeed() {
  const seed = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(seed).digest("hex");
  return { seed, hash };
}

export function hmacFloat(serverSeed: string, clientSeed: string, nonce: number | string) {
  const h = createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}`).digest("hex");
  // Use first 13 hex chars as 52-bit integer / 2^52 → [0,1)
  const slice = h.slice(0, 13);
  const intVal = parseInt(slice, 16);
  return intVal / Math.pow(2, 52);
}

// Returns shuffled array of indices [0..n-1] using HMAC-SHA256 stream
export function fairShuffle<T>(arr: T[], serverSeed: string, clientSeed: string, nonce: number) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const r = hmacFloat(serverSeed, clientSeed, `${nonce}:${i}`);
    const j = Math.floor(r * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
