export function unavatarUrl(handle: string): string {
  const clean = handle.trim().replace(/^@/, "");
  return `https://unavatar.io/x/${encodeURIComponent(clean)}?fallback=false`;
}

export function localAvatarUrl(slug: string): string {
  return `/avatars/${slug}.jpg`;
}

export function avatarCandidates(person: {
  slug: string;
  handle: string;
  avatar_url?: string | null;
}): string[] {
  const urls: string[] = [];
  if (person.avatar_url) urls.push(person.avatar_url);
  urls.push(localAvatarUrl(person.slug));
  urls.push(unavatarUrl(person.handle));
  return [...new Set(urls)];
}

const SKIP_INITIAL_WORDS = new Set(["the", "mr", "ms", "mrs", "dr"]);

export function deskInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !SKIP_INITIAL_WORDS.has(part.toLowerCase()));
  if (parts.length === 0) return name.slice(0, 1).toUpperCase() || "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
