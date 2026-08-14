export function getSiteUrl(): string {
  const raw =
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // fall through
    }
  }
  return "http://localhost:3000";
}

export const DISCLAIMER =
  "Not investment advice. Figures are for research display only and are not a solicitation to buy or sell securities.";
