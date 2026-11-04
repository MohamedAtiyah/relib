import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { clerkEnabled } from "@/lib/clerk";

const pill = "rounded-full px-5 py-2.5 text-sm font-medium";

export default async function Landing() {
  const userId = clerkEnabled ? (await auth()).userId : null;
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <Logo />
        {clerkEnabled && !userId && (
          <SignInButton mode="modal" forceRedirectUrl="/app">
            <button className="text-sm text-muted hover:text-ink">Sign in</button>
          </SignInButton>
        )}
      </header>
      <section className="my-auto py-16">
        <h1 className="font-display text-5xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-6xl">
          The right information <span className="text-spark-ink">finds you.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Write your notes. Relib reads them, finds papers on OpenAlex and arXiv, and tells you how each one fits and where it falls short. It explains and
          questions; it never writes your work for you.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          {userId ? (
            <Link href="/app" className={`${pill} bg-ink text-paper`}>
              Open your workspace
            </Link>
          ) : (
            clerkEnabled && (
            <SignUpButton mode="modal" forceRedirectUrl="/app">
              <button className={`${pill} bg-ink text-paper`}>Create an account</button>
            </SignUpButton>
            )
          )}
          <Link href="/demo" className={`${pill} border border-hairline hover:bg-sand`}>
            Try the demo
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted">The demo needs no sign-in and uses saved results.</p>
      </section>
      <footer className="text-xs text-muted">Built with Meta Muse Spark · Sources from OpenAlex and arXiv</footer>
    </main>
  );
}
