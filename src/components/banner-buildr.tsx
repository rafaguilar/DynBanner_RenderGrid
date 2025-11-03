
"use client";

import { useState, useEffect } from "react";
import JSZip from "jszip";
import Papa from "papaparse";
import { getColumnMapping } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileUploadZone } from "./file-upload-zone";
import { BannerPreviewCard } from "./banner-preview-card";
import { ColumnMappingCard } from "./column-mapping-card";
import {
  Archive,
  FileText,
  Loader2,
  Download,
  CheckCircle2,
  Wand2,
  List,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type TemplateFiles = { [key: string]: string };
export type CsvData = Record<string, string>[];
export type ColumnMapping = Record<string, string>;
export type BannerVariation = { name: string; files: TemplateFiles };

export function BannerBuildr() {
  const [templateFiles, setTemplateFiles] = useState<TemplateFiles | null>(null);
  const [templateFileName, setTemplateFileName] = useState<string>("");
  const [csvData, setCsvData] = useState<CsvData | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [jsVariables, setJsVariables] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [bannerVariations, setBannerVariations] = useState<BannerVariation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [isMappingComplete, setIsMappingComplete] = useState(false);
  const { toast } = useToast();

  const handleTemplateUpload = async (file: File) => {
    setIsLoading(true);
    setLoadingMessage("Processing template...");
    setTemplateFileName(file.name);
    try {
      const zip = await JSZip.loadAsync(file);
      const files: TemplateFiles = {};
      let dynamicJsContent: string | null = null;
      let hasIndexHtml = false;
  
      const filePromises = Object.keys(zip.files).map(async (filename) => {
        if (!zip.files[filename].dir) {
          const fileData = zip.files[filename];
          // Find the last part of the path to handle nested files
          const normalizedFilename = filename.substring(filename.lastIndexOf('/') + 1) || filename;
          const content = await fileData.async("string");
          files[normalizedFilename] = content;

          if (normalizedFilename.toLowerCase() === "dynamic.js") {
            dynamicJsContent = content;
          }
          if (normalizedFilename.toLowerCase() === "index.html") {
            hasIndexHtml = true;
          }
        }
      });
      await Promise.all(filePromises);
  
      if (!hasIndexHtml || !dynamicJsContent) {
        throw new Error("Template must include index.html and Dynamic.js");
      }
  
      setTemplateFiles(files);
      setJsVariables(['devDynamicContent.parent[0].custom_offer']);

      toast({ title: "Success", description: "Template uploaded successfully." });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to process zip file.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
      setTemplateFileName("");
      setTemplateFiles(null);
      setJsVariables([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataUpload = (file: File) => {
    setIsLoading(true);
    setLoadingMessage("Parsing data file...");
    setCsvFileName(file.name);
    setColumnMapping(null); // Reset mapping when new data is uploaded
    setIsMappingComplete(false);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data as CsvData);
        setCsvColumns(results.meta.fields || []);
        setIsLoading(false);
        toast({ title: "Success", description: "Data file uploaded successfully." });
      },
      error: (error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setIsLoading(false);
        setCsvFileName("");
      },
    });
  };

  useEffect(() => {
    const dynamicJsContent = templateFiles ? templateFiles['Dynamic.js'] : null;

    if (dynamicJsContent && csvColumns.length > 0 && !columnMapping && !isMappingComplete) {
      const runMapping = async () => {
        setIsLoading(true);
        setLoadingMessage("AI is mapping columns...");
        try {
          const mapping = await getColumnMapping({
            dynamicJsContent: dynamicJsContent,
            csvColumns: csvColumns,
          });
          setColumnMapping(mapping);
          toast({ title: "AI Complete", description: "Column mapping attempted." });
        } catch (e) {
            console.error(e);
            toast({ title: "AI Error", description: "Failed to map columns automatically. Please map them manually.", variant: "destructive" });
            setColumnMapping({}); 
        } finally {
          setIsLoading(false);
        }
      };
      runMapping();
    }
  }, [templateFiles, csvColumns, columnMapping, isMappingComplete]);

  const handleGenerateBanners = () => {
    if (!csvData || !columnMapping || !templateFiles) {
        toast({ title: "Warning", description: "Please complete all previous steps.", variant: "destructive" });
        return;
    };

    setIsLoading(true);
    setLoadingMessage(`Generating ${csvData.length} banners...`);

    try {
      const newVariations: BannerVariation[] = csvData.map((row, index) => {
        const dynamicJsPath = 'Dynamic.js';
        let newDynamicJsContent = templateFiles[dynamicJsPath] || "";
        
        for (const csvColumn in columnMapping) {
          if (row[csvColumn] && columnMapping[csvColumn]) {
            const jsVariablePath = columnMapping[csvColumn];
            const valueToSet = row[csvColumn];
            
            if (jsVariablePath === 'devDynamicContent.parent[0].custom_offer') {
                const regex = /(devDynamicContent\.parent\[0\]\.custom_offer\s*=\s*['"])([^'"]*)(['"]?)/;
                if (regex.test(newDynamicJsContent)) {
                  newDynamicJsContent = newDynamicJsContent.replace(regex, `$1${valueToSet}$3`);
                } else {
                  console.warn(`Could not find "${jsVariablePath}" in Dynamic.js to replace.`);
                }
            }
          }
        }
        
        const variationName = `Variation_${index + 1}_${
          row[Object.keys(row)[0]] || "data"
        }`.replace(/[^a-zA-Z0-9_-]/g, '');

        const newFiles = { ...templateFiles };
        newFiles[dynamicJsPath] = newDynamicJsContent;
        
        return {
          name: variationName,
          files: newFiles,
        };
      });
      setBannerVariations(newVariations);
      toast({ title: "Success", description: `${newVariations.length} banners generated.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to generate banners.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (bannerVariations.length === 0) return;
    setIsLoading(true);
    setLoadingMessage("Preparing all banners for download...");
    const zip = new JSZip();
    for (const variation of bannerVariations) {
      const folder = zip.folder(variation.name);
      if(folder){
        for (const fileName in variation.files) {
            folder.file(fileName, variation.files[fileName]);
        }
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BannerBuildr_All_Variations.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsLoading(false);
  };
  
  const resetState = () => {
    setTemplateFiles(null);
    setTemplateFileName("");
    setCsvData(null);
    setCsvFileName("");
    setCsvColumns([]);
    setJsVariables([]);
    setColumnMapping(null);
    setBannerVariations([]);
    setIsMappingComplete(false);
    setIsLoading(false);
  }

  const renderStep = (
    step: number,
    title: string,
    description: string,
    isComplete: boolean,
    content: React.ReactNode
  ) => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          {isComplete ? (
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          ) : (
            <div className={`w-8 h-8 rounded-full ${isComplete ? 'bg-green-500' : 'bg-primary'} text-primary-foreground flex items-center justify-center font-bold text-lg`}>
                {step}
            </div>
          )}
          <div>
            <CardTitle className="font-headline">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      {!isComplete && <CardContent>{content}</CardContent>}
      {isComplete && templateFileName && title.includes('Template') && <CardContent><p className="text-sm text-muted-foreground flex items-center"><Archive className="w-4 h-4 mr-2"/>{templateFileName}</p></CardContent>}
      {isComplete && csvFileName && title.includes('Data') && <CardContent><p className="text-sm text-muted-foreground flex items-center"><List className="w-4 h-4 mr-2"/>{csvFileName} ({csvData?.length} rows)</p></CardContent>}

    </Card>
  );

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-bold tracking-tight font-headline">
          Create Banner Variations in Seconds
        </h2>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
          Upload your banner template and data file, and let our AI-powered tool
          generate all your variations instantly.
        </p>
      </div>
      <div className="space-y-4 max-w-4xl mx-auto">
        {renderStep(1, "Upload Template", "Upload your compressed (.zip) banner template.", !!templateFiles, 
            <FileUploadZone
            onFileUpload={handleTemplateUpload}
            title="Upload Template"
            description="Drag & drop a .zip file or click to select"
            accept=".zip"
            Icon={Archive}
            />
        )}

        {templateFiles && renderStep(2, "Upload Data", "Import a .csv file with your variable data.", !!csvData,
            <FileUploadZone
            onFileUpload={handleDataUpload}
            title="Upload Data File"
            description="Drag & drop a .csv file or click to select"
            accept=".csv"
            Icon={FileText}
            />
        )}

        {csvData && columnMapping && !isMappingComplete && jsVariables.length > 0 && (
            <ColumnMappingCard
                csvColumns={csvColumns}
                jsVariables={jsVariables}
                initialMapping={columnMapping}
                onMappingConfirm={(finalMapping) => {
                    setColumnMapping(finalMapping);
                    setIsMappingComplete(true);
                    toast({ title: "Mapping Confirmed", description: "Ready to generate banners." });
                }}
            />
        )}


        {isMappingComplete && (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg`}>
                            4
                        </div>
                        <div>
                            <CardTitle className="font-headline">Generate Banners</CardTitle>
                            <CardDescription>All steps are complete. Ready to build!</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">Ready to generate <strong>{csvData?.length || 0}</strong> unique banner variations.</p>
                    <Button onClick={handleGenerateBanners} disabled={isLoading || bannerVariations.length > 0} size="lg">
                    {isLoading && loadingMessage.includes('Generating') ? <Loader2 className="mr-2 animate-spin" /> : <Wand2 className="mr-2" />}
                    Generate Banners
                    </Button>
                </CardContent>
            </Card>
        )}
      </div>

      {loadingMessage && isLoading && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin" />
            <span>{loadingMessage}</span>
        </div>
      )}

      {bannerVariations.length > 0 && (
        <div className="space-y-8 pt-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="text-3xl font-bold font-headline text-center sm:text-left">Your Generated Banners</h3>
                <div className="flex gap-2">
                    <Button onClick={handleDownloadAll} disabled={isLoading}>
                        <Download className="mr-2" /> Download All (.zip)
                    </Button>
                     <Button onClick={resetState} variant="outline">Start Over</Button>
                </div>
            </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bannerVariations.map((variation) => (
              <BannerPreviewCard key={variation.name} {...variation} />
            ))}
          </div>
        </div>
      )}

      {!templateFiles && !isLoading && (
          <Alert className="max-w-4xl mx-auto">
                <Wand2 className="h-4 w-4" />
                <AlertTitle className="font-headline">Welcome to BannerBuildr!</AlertTitle>
                <AlertDescription>
                Start by uploading your banner template ZIP file to begin the process.
                </AlertDescription>
            </Alert>
      )}

    </div>
  );

    