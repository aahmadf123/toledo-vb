"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview", short: "Home" },
  { href: "/trends", label: "Trends", short: "Trends" },
  { href: "/players", label: "Players", short: "Players" },
  { href: "/connection", label: "Connection", short: "Setters" },
  { href: "/set-types", label: "Set Types", short: "Sets" },
  { href: "/health", label: "Data Health", short: "Data" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 bg-rocket-blue text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="Toledo" width={120} height={40} className="h-8 w-auto" />
            <span className="text-sm font-semibold tracking-wide max-sm:hidden">VOLLEYBALL</span>
          </Link>
          <nav className="ml-auto hidden gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-rocket-gold text-rocket-blue-dark"
                    : "text-white/85 hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 md:pb-10">{children}</main>

      {/* Bottom tab bar for phones — coaches open this courtside. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-neutral-200 bg-white/95 backdrop-blur md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 py-3 text-center text-[11px] font-medium ${
              isActive(item.href) ? "text-rocket-blue" : "text-neutral-400"
            }`}
          >
            {item.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
