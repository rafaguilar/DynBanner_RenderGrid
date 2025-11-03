
"use client";

import { useMemo, useState } from "react";
import JSZip from "jszip";
import { Button } from "./ui/button";
import { Download } from "lucide-react";
import type { BannerVariation } from "./banner-buildr";

export const BannerPreviewCard: React.FC<BannerVariation> = ({
  name,
  files,
  bannerId,
  htmlFile,
  width,
  height,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const previewUrl = useMemo(() => {
    if (bannerId && htmlFile) {
      return `/api/preview/${bannerId}/${htmlFile}`;
    }
    // Client-side preview logic (if needed) could go here
    return "";
  }, [bannerId, htmlFile]);
  
  const handleSingleDownload = async () => {
    if (!Object.keys(files).length && (!bannerId || !htmlFile)) {
      console.warn("No files available for download.");
      // Here you might want to show a toast or disable the button more visibly
      return;
    }

    setIsLoading(true);
    let filesToZip = files;

    // If files are not passed directly, it means it's a generated preview.
    // We need to fetch/recreate the files for zipping.
    if (!Object.keys(filesToZip).length && bannerId) {
        // This is a simplified example. In a real app, you would
        // need an API endpoint to fetch the files for a given bannerId.
        // For now, we'll just zip the main HTML file.
        // A proper implementation would fetch all associated assets.
        try {
            const response = await fetch(previewUrl);
            if (response.ok) {
                const htmlContent = await response.text();
                // In a real app, you'd need to fetch all assets (CSS, JS, images)
                // that are referenced in the HTML and add them to the zip.
                // This is a complex task. For this demo, we'll just zip the HTML.
                filesToZip = { [htmlFile!]: htmlContent };
            } else {
                throw new Error("Failed to fetch banner content for download.");
            }
        } catch (error) {
            console.error(error);
            setIsLoading(false);
            return;
        }
    }


    const zip = new JSZip();
    for (const fileName in filesToZip) {
       zip.file(fileName, filesToZip[fileName]);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${name}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsLoading(false);
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
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-full border-0"
            style={{ width: `${effectiveWidth}px`, height: `${effectiveHeight}px` }}
            scrolling="no"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            {isLoading ? "Loading Preview..." : "Preview not available."}
          </div>
        )}
      </div>
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
        <Button onClick={handleSingleDownload} variant="secondary" size="icon" disabled={isLoading}>
          <Download />
        </Button>
      </div>
    </div>
  );
};
