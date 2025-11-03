
"use client";

import { useState, useEffect } from "react";
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
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";

export type CsvData = Record<string, string>[];
export type ColumnMapping = Record<string, string>;
export type BannerVariation = {
  name: string;
  bannerId: string;
  htmlFile: string;
  width: number;
  height: number;
  files?: Record<string, string | Buffer>; // For download purposes
};

export function BannerBuildr() {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateFileName, setTemplateFileName] = useState<string>("");
  
  const [csvFile, setCsvFile] = useState<File | null>(null);
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
  
  const [originalBanner, setOriginalBanner] = useState<BannerVariation | null>(null);
  const [dynamicJsContent, setDynamicJsContent] = useState<string | null>(null);


  const handleTemplateUpload = async (file: File) => {
    resetState();
    setIsLoading(true);
    setLoadingMessage("Processing template...");
    setTemplateFileName(file.name);
    setTemplateFile(file);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload template.');
      }
      
      const { bannerId, htmlFile, dynamicJsContent, width, height } = await response.json();

      if (!htmlFile) {
        throw new Error("Template must include an index.html file.");
      }
      
      setDynamicJsContent(dynamicJsContent || "");
      
      const extractedVars = dynamicJsContent?.match(/devDynamicContent\.[a-zA-Z0-9_\[\]\.]+/g) || [];
      const uniqueVars = [...new Set(extractedVars)];
      setJsVariables(uniqueVars);

      const originalPreview: BannerVariation = {
          name: "Original Template Preview",
          bannerId,
          htmlFile,
          width,
          height,
      };

      setOriginalBanner(originalPreview);
      setBannerVariations([originalPreview]);
      
      toast({ title: "Success", description: "Template uploaded and preview generated." });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to process zip file.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
      resetState();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataUpload = (file: File) => {
    setIsLoading(true);
    setLoadingMessage("Parsing data file...");
    setCsvFileName(file.name);
    setCsvFile(file);
    setBannerVariations(originalBanner ? [originalBanner] : []);
    setColumnMapping(null); 
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
          if (Object.keys(mapping).length > 0) {
            toast({ title: "AI Complete", description: "Column mapping suggested. Please review." });
          } else {
            toast({ title: "Manual Mapping Needed", description: "Could not map columns automatically.", variant: 'default' });
          }
        } catch (e) {
            console.error("AI mapping failed:", e);
            toast({ title: "AI Error", description: "Proceed with manual mapping.", variant: "destructive" });
            setColumnMapping({}); 
        } finally {
          setIsLoading(false);
        }
      };
      runMapping();
    }
  }, [dynamicJsContent, csvColumns, columnMapping, isMappingComplete]);


  const handleGenerateBanners = async () => {
    if (!csvFile || !columnMapping || !templateFile || !originalBanner) {
        toast({ title: "Warning", description: "Please complete all previous steps.", variant: "destructive" });
        return;
    };

    setIsLoading(true);
    setLoadingMessage(`Generating ${csvData?.length || 0} banners...`);

    try {
        const formData = new FormData();
        formData.append('template', templateFile);
        formData.append('csv', csvFile);
        formData.append('columnMapping', JSON.stringify(columnMapping));
        formData.append('dynamicJsContent', dynamicJsContent || '');

        const response = await fetch('/api/generate', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate banners on server.');
        }

        const newVariations: BannerVariation[] = await response.json();
      
        setBannerVariations([originalBanner, ...newVariations]);
        toast({ title: "Success", description: `${newVariations.length} banners generated.` });
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : "Failed to generate banners.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  const handleDownloadAll = async () => {
    const variationsToDownload = bannerVariations.filter(v => v.name !== 'Original Template Preview');
    if (variationsToDownload.length === 0) return;
    
    setIsLoading(true);
    setLoadingMessage("Preparing all banners for download...");
    
    try {
        const zip = new JSZip();

        // Use the /api/download/[bannerId] route to fetch the files for each variation
        const downloadPromises = variationsToDownload.map(async (variation) => {
            const folder = zip.folder(variation.name);
            if(folder){
                try {
                    const response = await fetch(`/api/download/${variation.bannerId}`);
                    if (!response.ok) {
                        console.error(`Failed to fetch files for ${variation.name}`);
                        return;
                    }
                    const filesZip = await JSZip.loadAsync(await response.arrayBuffer());
                    for (const filename in filesZip.files) {
                        const fileData = await filesZip.files[filename].async('nodebuffer');
                        folder.file(filename, fileData);
                    }
                } catch (error) {
                    console.error(`Error downloading variation ${variation.name}:`, error);
                }
            }
        });
    
        await Promise.all(downloadPromises);

        const blob = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `BannerBuildr_Variations.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Failed to create master zip:", error);
        toast({ title: "Error", description: "Could not prepare files for download.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };
  
  const resetState = () => {
    setTemplateFile(null);
    setTemplateFileName("");
    setCsvFile(null);
    setCsvData(null);
    setCsvFileName("");
    setCsvColumns([]);
    setJsVariables([]);
    setColumnMapping(null);
    setBannerVariations([]);
    setIsMappingComplete(false);
    setIsLoading(false);
    setOriginalBanner(null);
    setDynamicJsContent(null);
  }

  const renderStep = (
    step: number,
    title: string,
    description: string,
    isComplete: boolean,
    content: React.ReactNode,
    isNextStepAvailable: boolean
  ) => {
      const showContent = !isComplete && isNextStepAvailable;
      return (
        <Card className={!isNextStepAvailable ? "opacity-50" : ""}>
          <CardHeader>
            <div className="flex items-center gap-4">
              {isComplete ? (
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              ) : (
                <div className={`w-8 h-8 rounded-full ${isNextStepAvailable ? 'bg-primary' : 'bg-muted'} text-primary-foreground flex items-center justify-center font-bold text-lg`}>
                    {step}
                </div>
              )}
              <div>
                <CardTitle className="font-headline">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          {showContent && <CardContent>{content}</CardContent>}
          {isComplete && templateFileName && title.includes('Template') && <CardContent><p className="text-sm text-muted-foreground flex items-center"><Archive className="w-4 h-4 mr-2"/>{templateFileName}</p></CardContent>}
          {isComplete && csvFileName && title.includes('Data') && <CardContent><p className="text-sm text-muted-foreground flex items-center"><List className="w-4 h-4 mr-2"/>{csvFileName} ({csvData?.length} rows)</p></CardContent>}

        </Card>
      )
  };
  
  const bannersGenerated = bannerVariations.length > 1;
  const showMappingCard = csvData && dynamicJsContent && !isMappingComplete && jsVariables.length > 0;
  const showGenerateCard = isMappingComplete;
  const isGenerating = isLoading && loadingMessage.includes('Generating');

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
            <div className="text-left">
                <h2 className="text-4xl font-bold tracking-tight font-headline">
                BannerBuildr
                </h2>
                <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
                    Create banner variations from a template and a data file instantly.
                </p>
            </div>
            <Button onClick={resetState} variant="outline">
                <RefreshCw className="mr-2" /> Start Over
            </Button>
        </div>
      <div className="space-y-4 max-w-4xl mx-auto">
        {renderStep(1, "Upload Template", "A .zip file with index.html and related assets.", !!templateFile, 
            <FileUploadZone
            onFileUpload={handleTemplateUpload}
            title="Upload Template"
            description="Drag & drop a .zip file or click to select"
            accept=".zip"
            Icon={Archive}
            />,
            true
        )}

        {renderStep(2, "Upload Data (Optional)", "A .csv file with your variable data.", !!csvData,
            <FileUploadZone
            onFileUpload={handleDataUpload}
            title="Upload Data File"
            description="Drag & drop a .csv file or click to select"
            accept=".csv"
            Icon={FileText}
            />,
            !!templateFile
        )}

        {showMappingCard && (
            <ColumnMappingCard
                csvColumns={csvColumns}
                jsVariables={jsVariables}
                initialMapping={columnMapping || {}}
                onMappingConfirm={(finalMapping) => {
                    setColumnMapping(finalMapping);
                    setIsMappingComplete(true);
                    toast({ title: "Mapping Confirmed", description: "Ready to generate banners." });
                }}
            />
        )}


        {showGenerateCard && (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                        <div>
                            <CardTitle className="font-headline">Mapping Complete</CardTitle>
                            <CardDescription>All steps are complete. Ready to build!</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">Ready to generate <strong>{csvData?.length || 0}</strong> unique banner variations.</p>
                    <Button onClick={handleGenerateBanners} disabled={isGenerating || bannersGenerated } size="lg">
                    {isGenerating ? <Loader2 className="mr-2 animate-spin" /> : <Wand2 className="mr-2" />}
                    {bannersGenerated ? "Banners Generated" : "Generate Banners"}
                    </Button>
                </CardContent>
            </Card>
        )}
      </div>

      {isLoading && !isGenerating && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin" />
            <span>{loadingMessage}</span>
        </div>
      )}

      {bannerVariations.length > 0 && (
        <div className="space-y-8 pt-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="text-3xl font-bold font-headline text-center sm:text-left">
                    {bannersGenerated ? "Your Generated Banners" : "Template Preview"}
                </h3>
                {bannersGenerated && (
                     <Button onClick={handleDownloadAll} disabled={isLoading}>
                        <Download className="mr-2" /> Download All ({bannerVariations.length -1})
                    </Button>
                )}
            </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bannerVariations.map((variation) => (
              <BannerPreviewCard key={variation.name} {...variation} />
            ))}
          </div>
        </div>
      )}

      {!templateFile && !isLoading && (
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
}
