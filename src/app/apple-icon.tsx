import { ImageResponse } from "next/og";
import { logoSvg } from "@/components/logo-svg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(logoSvg({ radius: 0 }))}`;
  return new ImageResponse(<img src={src} width={180} height={180} alt="" />, size);
}
