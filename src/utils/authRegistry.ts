export function normalizeResidentName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeHouseBlock(block: string): string {
  return block
    .trim()
    .toLowerCase()
    .replace(/^blok\s+/i, '')
    .replace(/[^a-z0-9]/g, '');
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_-]{3,30}$/.test(normalizeUsername(username));
}

export function usernameToAuthEmail(username: string): string {
  return `${normalizeUsername(username)}@akun.siskeurt12.id`;
}

export async function computeResidentRegistryId(
  fullName: string,
  houseBlock: string
): Promise<string> {
  const canonical = `${normalizeResidentName(fullName)}|${normalizeHouseBlock(houseBlock)}`;
  const bytes = new TextEncoder().encode(canonical);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i];
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= bytes[i] + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `reg_${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}
