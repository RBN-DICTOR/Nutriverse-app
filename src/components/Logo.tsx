export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="NutriVerse logo">
      <circle cx="24" cy="24" r="24" fill="#123B2A" />
      <g fill="none" strokeWidth="4" transform="rotate(-90 24 24)">
        <circle cx="24" cy="24" r="18" stroke="#4DBB78" strokeDasharray="54.05 59.05" strokeDashoffset="0" />
        <circle cx="24" cy="24" r="18" stroke="#F16B59" strokeDasharray="25.77 87.33" strokeDashoffset="-56.55" />
        <circle cx="24" cy="24" r="18" stroke="#FFA45B" strokeDasharray="25.77 87.33" strokeDashoffset="-84.82" />
      </g>
      <circle cx="24" cy="24" r="11" fill="#FFF8E9" />
      <path d="M24 28 L24 22" stroke="#123B2A" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M24 24 C24 18 29 16 32 16 C32 21 29 24 24 24Z" fill="#4DBB78" />
      <path d="M24 27 C24 22 20 20 16 20.5 C16 25 19 27 24 27Z" fill="#123B2A" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="logo-lockup">
      <LogoMark />
      <span className="logo-word" style={{ color: light ? '#FFF8E9' : '#123B2A' }}>
        Nutri<b style={{ color: light ? '#C6F36B' : '#2F7D4F' }}>Verse</b>
      </span>
    </span>
  );
}
