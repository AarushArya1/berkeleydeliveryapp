import { ImageResponse } from "next/og";
import { logoSvg } from "@/components/logo-svg";

const SIZES = new Set(["192", "512", "maskable"]);

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await ctx.params;
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const px = size === "192" ? 192 : 512;
  // Maskable icons get cropped to a circle/squircle, so keep the mark inside the safe zone.
  const inner = size === "maskable" ? Math.round(px * 0.7) : px;
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(logoSvg({ radius: size === "maskable" ? 0 : 14 }))}`;
  return new ImageResponse(
    (
      <div style={{ width: px, height: px, display: "flex", alignItems: "center", justifyContent: "center", background: "#d4f09a" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={inner} height={inner} alt="" />
      </div>
    ),
    { width: px, height: px },
  );
}
