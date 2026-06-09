export default function Footer() {
  return (
    <footer className="relative border-t border-[rgba(148,163,184,0.15)] bg-white/50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          &copy; {new Date().getFullYear()} Parag Jindal. All rights reserved.
        </p>
        <p className="text-sm font-medium text-[var(--color-text-muted)]">
          Crafted with <span className="text-[var(--color-accent-blue)]">React</span> &amp; <span className="text-[var(--color-text-primary)]">Tailwind</span>
        </p>
      </div>
    </footer>
  );
}
