
"use client";

import { useState, useEffect } from "react";
import JSZip from "jszip";
import { Button } from "./ui/button";
import { Download } from "lucide-react";
import type { BannerVariation } from "./banner-buildr";

export const BannerPreviewCard: React.FC<BannerVariation> = ({
  name,
  bannerId,
  htmlFile,
  width,
  height,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const previewUrl = useMemo(() => {
    if (bannerId && htmlFile) {
        return `/api/preview/${bannerId}/${htmlFile}`;
    }
    return "";
  }, [bannerId, htmlFile]);
  

  const handleSingleDownload = async () => {
    if (!bannerId) {
      console.warn("No bannerId available for download for this variation.");
      return;
    }
    setIsDownloading(true);
    try {
        const response = await fetch(`/api/download/${bannerId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch banner for download');
        }
        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${name}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch(e) {
        console.error("Download failed", e);
    } finally {
        setIsDownloading(false);
    }
  };

  const effectiveWidth = width || 300;
  const effectiveHeight = height || 250;

  return (
    <div className="relative group" style={{ width: `${effectiveWidth}px`, height: `${effectiveHeight}px` }}>
      <div className="w-full h-full bg-muted rounded-md overflow-hidden border">
        {previewUrl ? (
          <iframe
            src={previewUrl}
            title={name}
            sandbox="allow-scripts"
            className="w-full h-full border-0"
            style={{ width: `${effectiveWidth}px`, height: `${effectiveHeight}px` }}
            scrolling="no"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-center p-4">Preview not available</div>
        )}
      </div>
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
        <Button onClick={handleSingleDownload} variant="secondary" size="icon" disabled={isDownloading}>
          <Download />
        </Button>
      </div>
    </div>
  );
};
