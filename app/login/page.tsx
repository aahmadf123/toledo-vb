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
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-rocket-blue px-6">
      <Image
        src="/logo.png"
        alt="University of Toledo"
        width={220}
        height={73}
        priority
        className="h-auto w-52"
      />
      <form action={login} className="flex w-full max-w-xs flex-col gap-3">
        <h1 className="text-center text-lg font-semibold text-white">
          Toledo Volleyball Dashboard
        </h1>
        {from ? <input type="hidden" name="from" value={from} /> : null}
        <input
          type="password"
          name="password"
          placeholder="Team password"
          autoFocus
          required
          className="rounded-lg border-0 bg-white px-4 py-3 text-base outline-none ring-rocket-gold focus:ring-2"
        />
        {error === "unconfigured" ? (
          <p className="text-center text-sm text-rocket-gold">
            No team password is configured yet — set TEAM_PASSWORD in the Vercel project settings.
          </p>
        ) : error ? (
          <p className="text-center text-sm text-rocket-gold">Wrong password — try again.</p>
        ) : null}
        <button
          type="submit"
          className="rounded-lg bg-rocket-gold px-4 py-3 text-base font-semibold text-rocket-blue-dark active:opacity-80"
        >
          Enter
        </button>
      </form>
    </main>
  );
}
