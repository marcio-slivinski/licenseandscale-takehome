import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Greenscape Pro · Proposals",
  description: "Draft proposals from site walk notes in 30 seconds. Review, edit, send.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-[var(--color-line)] bg-[var(--color-card)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-3 group">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand)] text-white font-semibold group-hover:bg-[var(--color-brand-dark)]">
                G
              </span>
              <span className="flex flex-col">
                <span className="text-base font-semibold tracking-tight leading-tight text-[var(--color-ink)]">Greenscape Pro</span>
                <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-muted)] leading-tight">Proposals</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <NavLink href="/">Dashboard</NavLink>
              <NavLink href="/settings/catalog">Catalog</NavLink>
              <NavLink href="/settings/voice">Style &amp; Voice</NavLink>
              <NavLink href="/health">System</NavLink>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
        <footer className="border-t border-[var(--color-line)] bg-[var(--color-card)]">
          <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-[var(--color-ink-muted)]">
            Greenscape Pro · Phoenix, Arizona
          </div>
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-[var(--color-ink-soft)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand-dark)]"
    >
      {children}
    </Link>
  );
}
