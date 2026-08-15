"use client";

import { useEffect, useMemo, useState } from "react";
import { avatarCandidates, deskInitials } from "@/lib/avatar";

type PersonLike = {
  slug: string;
  name: string;
  handle: string;
  accent: string;
  avatar_url?: string | null;
};

export function DeskAvatar({
  person,
  size = "md",
  className = "",
}: {
  person: PersonLike;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const candidates = useMemo(
    () =>
      avatarCandidates({
        slug: person.slug,
        handle: person.handle,
        avatar_url: person.avatar_url,
      }),
    [person.slug, person.handle, person.avatar_url],
  );
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [person.slug]);
  const src = candidates[index];
  const dim =
    size === "lg" ? "h-16 w-16 text-lg" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-11 w-11 text-sm";

  if (!src) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-mono font-bold text-[#0a0a0a] ${dim} ${className}`}
        style={{ backgroundColor: person.accent }}
        aria-hidden="true"
      >
        {deskInitials(person.name)}
      </span>
    );
  }

  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full bg-[var(--color-bg-elev)] ${dim} ${className}`}
      style={{ boxShadow: `0 0 0 1px ${person.accent}55` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        loading={size === "lg" ? "eager" : "lazy"}
        decoding="async"
        onError={() => setIndex((i) => i + 1)}
      />
    </span>
  );
}
