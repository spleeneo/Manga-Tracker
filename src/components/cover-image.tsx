"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";

export function CoverImage({ url, className, alt = "" }: { url?: string; className?: string; alt?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) return <div className="flex h-full w-full items-center justify-center bg-muted" aria-label="Cover unavailable"><ImageIcon className="h-10 w-10 opacity-25" /></div>;
  return <img src={url.startsWith("/") ? url : `/api/proxy/image?url=${encodeURIComponent(url)}`} alt={alt} loading="lazy" decoding="async" className={className} onError={() => setFailedUrl(url)} />;
}
