"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV = [
  { href: "/", label: "Overview", short: "Home" },
  { href: "/leaders", label: "Leaders", short: "Leaders" },
  { href: "/trends", label: "Trends", short: "Trends" },
  { href: "/players", label: "Players", short: "Players" },
  { href: "/connection", label: "Connection", short: "Setters" },
  { href: "/set-types", label: "Set Types", short: "Sets" },
  { href: "/box", label: "Box Scores", short: "Box" },
  { href: "/health", label: "Data Health", short: "Data" },
];

/** First four get bottom-bar slots on phones; the rest live in the More sheet. */
const MOBILE_PRIMARY = NAV.slice(0, 4);
const MOBILE_MORE = NAV.slice(4);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const moreActive = MOBILE_MORE.some((item) => isActive(item.href));

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-navy-700 bg-navy-900">
        <div className="mx-auto flex h-14 max-w-6xl items-stretch gap-4 px-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
          >
            <Image
              src="/rocket.png"
              alt="Toledo Rockets"
              width={100}
              height={28}
              className="h-7 w-auto"
            />
            <span className="font-display text-xl font-bold tracking-wider uppercase">
              <span className="text-gold">Toledo</span>{" "}
              <span className="text-ink max-sm:hidden">Volleyball</span>
            </span>
          </Link>
          <nav className="ml-auto hidden items-stretch gap-0.5 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`relative flex items-center px-2.5 font-display text-base font-semibold tracking-wide uppercase transition-colors focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset focus-visible:outline-none ${
                  isActive(item.href)
                    ? "text-gold"
                    : "text-ink-muted hover:bg-white/5 hover:text-ink"
                }`}
              >
                {item.label}
                {isActive(item.href) ? (
                  <span aria-hidden className="slash absolute inset-x-2 bottom-0 h-[3px]" />
                ) : null}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-24 md:pb-10">{children}</main>

      {/* Bottom tab bar for phones — coaches open this courtside. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-navy-700 bg-navy-900/95 backdrop-blur md:hidden">
        {MOBILE_PRIMARY.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`flex-1 py-3 text-center text-[11px] font-medium ${
              isActive(item.href) ? "text-gold" : "text-ink-muted"
            }`}
          >
            {item.short}
          </Link>
        ))}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                className={`flex-1 py-3 text-center text-[11px] font-medium ${
                  moreActive ? "text-gold" : "text-ink-muted"
                }`}
              >
                More
              </button>
            }
          />
          <SheetContent side="bottom" className="border-navy-700 bg-navy-900 pb-6">
            <SheetHeader>
              <SheetTitle className="font-display tracking-wide text-ink uppercase">
                More
              </SheetTitle>
              <SheetDescription className="sr-only">More pages</SheetDescription>
            </SheetHeader>
            <nav className="grid gap-1 px-2">
              {MOBILE_MORE.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive(item.href)
                      ? "bg-navy-800 text-gold"
                      : "text-ink hover:bg-navy-800"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
