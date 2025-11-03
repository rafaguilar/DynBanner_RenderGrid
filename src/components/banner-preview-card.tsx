
"use client";

import { useEffect, useState } from "react";
import JSZip from "jszip";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Download, Eye } from "lucide-react";
import type { BannerVariation } from "./banner-buildr";

export const BannerPreviewCard: React.FC<BannerVariation> = ({
  name,
  files,
}) => {
  const [srcDoc, setSrcDoc] = useState("");

  useEffect(() => {

    const indexHtmlPath = 'index.html';
    let finalHtml = files[indexHtmlPath] ? files[indexHtmlPath] : "<html><body>Error: index.html not found in template.</body></html>";
    
    if (!files[indexHtmlPath]) {
      setSrcDoc(finalHtml);
      return;
    }
    
    // Create blobs for CSS and JS files and generate object URLs
    const blobUrls: string[] = [];

    Object.keys(files).forEach(path => {
        const fileContent = files[path];
        if (path.endsWith('.js')) {
            const blob = new Blob([fileContent], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            blobUrls.push(url);
            finalHtml = finalHtml.replace(new RegExp(`src=["'](./)?${path}["']`, 'g'), `src="${url}"`);
        } else if (path.endsWith('.css')) {
            const blob = new Blob([fileContent], { type: 'text/css' });
            const url = URL.createObjectURL(blob);
            blobUrls.push(url);
            finalHtml = finalHtml.replace(new RegExp(`href=["'](./)?${path}["']`, 'g'), `href="${url}"`);
        }
    });
    
    setSrcDoc(finalHtml);

    return () => {
      blobUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [files]);

  const handleDownload = async () => {
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
        <CardDescription>Generated banner variation</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="aspect-video w-full bg-muted rounded-md overflow-hidden border">
          <iframe
            srcDoc={srcDoc}
            title={name}
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-full"
            loading="lazy"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleDownload} className="w-full" variant="secondary">
          <Download className="mr-2" />
          Download ZIP
        </Button>
      </CardFooter>
    </Card>
  );
};
