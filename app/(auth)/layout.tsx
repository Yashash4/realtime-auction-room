export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-12">
      {/* Atmospheric violet radial-gradient backdrop behind the centered card. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-background"
      >
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_-10%,color-mix(in_oklch,var(--color-primary)_22%,transparent),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(40%_40%_at_85%_110%,color-mix(in_oklch,var(--color-primary)_14%,transparent),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(35%_35%_at_15%_100%,color-mix(in_oklch,var(--color-primary)_10%,transparent),transparent_70%)]" />
      </div>
      {children}
    </main>
  );
}
