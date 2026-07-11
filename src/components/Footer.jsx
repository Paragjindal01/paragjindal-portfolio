export default function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-black/40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          Parag Jindal — AI, Software Development &amp; Technical Services
        </p>
        <p className="text-xs text-[var(--color-text-muted)] max-w-xl">
          Independent technology services. Employment affiliations are shown for professional
          experience only.
        </p>
        <p className="text-xs font-medium text-[var(--color-text-muted)]">
          &copy; {new Date().getFullYear()} Parag Jindal. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
