import { ImageResponse } from "next/og";
import { logoSvg } from "@/components/logo-svg";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(logoSvg())}`;
  return new ImageResponse(<img src={src} width={64} height={64} alt="" />, size);
}
