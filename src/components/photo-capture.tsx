"use client";

import { useRef, useState } from "react";
import { Camera, RefreshCw } from "lucide-react";

// Phone photos are often 3–8 MB; shrink before upload so it's fast on campus wifi.
async function shrink(file: File, maxSide = 1600): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function PhotoCapture({ label, onChange, maxSide }: { label: string; onChange: (file: File | null) => void; maxSide?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const small = await shrink(f, maxSide);
          setPreview(URL.createObjectURL(small));
          onChange(small);
        }}
      />
      {preview ? (
        <div className="relative overflow-hidden rounded-2xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="max-h-72 w-full object-cover" />
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-sm font-bold shadow"
          >
            <RefreshCw className="size-4" /> Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-lime-300 bg-lime-25 px-4 py-8 text-lime-900 active:bg-lime-50"
        >
          <Camera className="size-8" />
          <span className="font-bold">{label}</span>
        </button>
      )}
    </div>
  );
}
