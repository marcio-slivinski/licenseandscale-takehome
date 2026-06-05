import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-8 text-center">
      <h2 className="text-xl font-semibold">Not found</h2>
      <p className="mt-2 text-sm text-stone-600">That lead or proposal doesn&apos;t exist.</p>
      <Link href="/" className="mt-4 inline-block text-sm text-emerald-700 hover:underline">← Back to dashboard</Link>
    </div>
  );
}
