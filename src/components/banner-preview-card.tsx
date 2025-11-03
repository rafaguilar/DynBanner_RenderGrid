
"use client";

import { useEffect, useState, useMemo } from "react";
import JSZip from "jszip";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Download } from "lucide-react";
import type { BannerVariation } from "./banner-buildr";

export const BannerPreviewCard: React.FC<BannerVariation> = ({
  name,
  files,
  bannerId,
  htmlFile,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const previewUrl = useMemo(() => {
    if (bannerId && htmlFile) {
      return `/api/preview/${bannerId}/${htmlFile}`;
    }
    return "";
  }, [bannerId, htmlFile]);


  const handleDownload = async () => {
    if (bannerVariations.length === 0) return;
    setIsLoading(true);
    setLoadingMessage("Preparing all banners for download...");
    const zip = new JSZip();

    // The bannerVariations are generated on the client, so we need to create the files
    // on the fly before zipping.
    const bannerPromises = bannerVariations.map(async (variation) => {
        if (variation.bannerId && variation.htmlFile) {
            // This is a generated variation, we need to regenerate the files for download
            const updatedFiles = await generateBannerFiles(variation);
            const folder = zip.folder(variation.name);
            if(folder){
                Object.keys(updatedFiles).forEach(fileName => {
                    folder.file(fileName, updatedFiles[fileName]);
                });
            }
        }
    });

    await Promise.all(bannerPromises);
    
    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BannerBuildr_Variations.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsLoading(false);
  };
  
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
        const response = await fetch(previewUrl);
        if (response.ok) {
            const htmlContent = await response.text();
            filesToZip = { [htmlFile!]: htmlContent };
        } else {
            setIsLoading(false);
            console.error("Failed to fetch banner content for download.");
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


  return (
    <div className="relative group w-full h-full">
      <div className="w-full h-full bg-muted rounded-md overflow-hidden border">
        {isLoading && !previewUrl ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            Loading Preview...
          </div>
        ) : previewUrl ? (
          <iframe
            src={previewUrl}
            title={name}
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-full border-0"
            scrolling="no"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            Preview not available.
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
