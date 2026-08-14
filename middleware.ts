import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import people from "./data/people.json";

const SLUGS = new Set(
  (people as { slug: string; active?: boolean }[])
    .filter((p) => p.active !== false)
    .map((p) => p.slug),
);

const PASSTHROUGH = [
  /^\/$/,
  /^\/api\//,
  /^\/_next\//,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/missing$/,
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PASSTHROUGH.some((re) => re.test(pathname))) {
    return NextResponse.next();
  }
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 1) return NextResponse.next();
  if (SLUGS.has(parts[0])) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/missing";
  return NextResponse.rewrite(url, { status: 404 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
