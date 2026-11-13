import { logoSvg } from "./logo-svg";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: logoSvg({ radius: 18 }) }}
    />
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="text-xl font-extrabold tracking-tight text-ink">dart</span>
    </span>
  );
}
