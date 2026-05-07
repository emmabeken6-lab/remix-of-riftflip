// Roblox public API helpers (server-side only).

export type RobloxProfile = {
  robloxId: number;
  username: string;
  displayName: string;
  description: string;
  avatarUrl: string | null;
};

export async function lookupUsername(username: string): Promise<{ id: number; name: string; displayName: string } | null> {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
  });
  if (!res.ok) throw new Error(`Roblox lookup failed (${res.status})`);
  const json = (await res.json()) as { data?: Array<{ id: number; name: string; displayName: string }> };
  const hit = json.data?.[0];
  return hit ? { id: hit.id, name: hit.name, displayName: hit.displayName } : null;
}

export async function getAvatarUrl(robloxId: number): Promise<string | null> {
  const res = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png&isCircular=true`
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: Array<{ imageUrl: string; state: string }> };
  return json.data?.[0]?.imageUrl ?? null;
}

export async function getProfile(robloxId: number): Promise<RobloxProfile | null> {
  const res = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    id: number;
    name: string;
    displayName: string;
    description: string;
  };
  const avatar = await getAvatarUrl(robloxId);
  return {
    robloxId: json.id,
    username: json.name,
    displayName: json.displayName,
    description: json.description ?? "",
    avatarUrl: avatar,
  };
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars
export function newVerificationCode() {
  const pick = (n: number) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  return `RIFT-${pick(4)}-${pick(4)}`;
}
