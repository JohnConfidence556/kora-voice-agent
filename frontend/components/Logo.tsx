import { BRAND } from "@/lib/brand";

// Four rising bars: signal strength, and the strings of a kora.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logoMark">
      <rect x="1" y="19" width="5" height="11" rx="2.5" />
      <rect x="9" y="13" width="5" height="17" rx="2.5" />
      <rect x="17" y="7" width="5" height="23" rx="2.5" />
      <rect x="25" y="1" width="5" height="29" rx="2.5" className="logoMark__hi" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo__name">{BRAND.name}</span>
    </span>
  );
}
