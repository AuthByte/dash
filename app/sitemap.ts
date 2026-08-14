import type { MetadataRoute } from "next";
import { getPeople } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const people = await getPeople();
  const origin = process.env.SITE_URL ?? "http://localhost:3000";
  return [
    { url: origin, changeFrequency: "daily", priority: 1 },
    ...people.map((person) => ({
      url: `${origin}/${person.slug}`,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
  ];
}
