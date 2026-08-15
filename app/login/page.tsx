import Image from "next/image";
import { login } from "./actions";

export const metadata = { title: "Log in — Toledo VB" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { error, from } = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-navy-950 px-6">
      <Image
        src="/logo-dark.png"
        alt="Toledo Rockets"
        width={260}
        height={151}
        priority
        className="h-auto w-64"
      />
      <form action={login} className="flex w-full max-w-xs flex-col gap-3">
        <h1 className="text-center font-display text-xl font-semibold tracking-wide text-ink uppercase">
          Volleyball Dashboard
        </h1>
        {from ? <input type="hidden" name="from" value={from} /> : null}
        <input
          type="password"
          name="password"
          placeholder="Team password"
          autoFocus
          required
          className="rounded-lg border border-navy-700 bg-navy-800 px-4 py-3 text-base text-ink outline-none placeholder:text-ink-muted focus:ring-2 focus:ring-gold"
        />
        {error === "unconfigured" ? (
          <p className="text-center text-sm text-gold">
            No team password is configured yet — set TEAM_PASSWORD in the Vercel project settings.
          </p>
        ) : error ? (
          <p className="text-center text-sm text-gold">Wrong password — try again.</p>
        ) : null}
        <button
          type="submit"
          className="rounded-lg bg-gold px-4 py-3 text-base font-semibold text-navy-950 hover:bg-gold-hover focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950 focus-visible:outline-none active:opacity-80"
        >
          Enter
        </button>
      </form>
    </main>
  );
}
