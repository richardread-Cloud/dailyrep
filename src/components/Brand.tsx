export function Brand({ big = false }: { big?: boolean }) {
  return (
    <span className={`brand${big ? ' big' : ''}`} role="img" aria-label="DailyRep">
      <svg className="brand-mark" viewBox="16 10 70 80" aria-hidden="true">
        <rect className="stroke" x="20" y="14" width="14" height="72" rx="2" />
        <polygon className="stroke" points="42,48 58,48 82,86 65,86" />
        <circle className="ring" cx="56" cy="36" r="15" />
      </svg>
      <span className="brand-word" aria-hidden="true">Daily<b>Rep</b></span>
    </span>
  );
}
