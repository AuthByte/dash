import type { MetadataRoute } from "next";
import { getPeople } from "@/lib/data";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const people = await getPeople();
  const origin = getSiteUrl();
  return [
    { url: origin, changeFrequency: "daily", priority: 1 },
    ...people
      .filter((person) => person.active !== false)
      .map((person) => ({
        url: `${origin}/${person.slug}`,
        changeFrequency: "hourly" as const,
        priority: 0.8,
      })),
  ];
}
