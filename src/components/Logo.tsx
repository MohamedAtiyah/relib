export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
        <path fill="currentColor" d="M8 3h16a2 2 0 0 1 2 2v24l-10-7-10 7V5a2 2 0 0 1 2-2z" />
        <circle cx="16" cy="12" r="3.5" fill="var(--spark)" />
      </svg>
      <span className="font-display text-xl font-semibold leading-none tracking-[-0.03em]">relib</span>
    </span>
  );
}
