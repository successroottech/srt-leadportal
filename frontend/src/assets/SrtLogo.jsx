export default function SrtLogo({ size = 40, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-label="Success Root Technologies">
      <rect x="6" y="6" width="88" height="88" rx="20" fill="#F5B400" />
      <text
        x="50"
        y="68"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="44"
        fill="#0B2C57"
        textAnchor="middle"
      >
        SRT
      </text>
    </svg>
  );
}
