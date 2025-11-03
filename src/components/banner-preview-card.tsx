
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
    // This part of the download logic will need to be adjusted
    // if the files are generated on the server.
    // For now, we assume `files` prop is populated for download.
    if (!Object.keys(files).length) {
      console.warn("No files available for download on the client.");
      // Potentially fetch from server if needed
      return;
    }
    const zip = new JSZip();
    for (const fileName in files) {
       zip.file(fileName, files[fileName]);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${name}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline truncate">{name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="aspect-video w-full bg-muted rounded-md overflow-hidden border">
          {isLoading ? (
             <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Loading Preview...
             </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              title={name}
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Preview not available.
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleDownload} className="w-full" variant="secondary" disabled={!Object.keys(files).length}>
          <Download className="mr-2" />
          Download ZIP
        </Button>
      </CardFooter>
    </Card>
  );
};
