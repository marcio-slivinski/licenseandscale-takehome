import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Greenscape Pro · Proposal Drafter",
  description: "AI proposal drafter for Greenscape Pro — scope interpretation proxy + HITL approval.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight">Greenscape Pro</span>
              <span className="text-xs uppercase tracking-wider text-stone-500">Proposal Drafter</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/" className="text-stone-600 hover:text-stone-900">Dashboard</Link>
              <Link href="/settings/voice" className="text-stone-600 hover:text-stone-900">Voice Training</Link>
              <a href="/api/health" target="_blank" className="text-stone-400 hover:text-stone-700">Health</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
        <footer className="border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-stone-500">
            License &amp; Scale take-home · built by Marcio Slivinski · {new Date().getFullYear()}
          </div>
        </footer>
      </body>
    </html>
  );
}
