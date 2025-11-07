'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Wand2, Loader2, Database, RefreshCw, Sheet, Archive, Download, Folder, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import type { BannerVariation, Tier } from './banner-render-grid';
import { BannerPreviewCard } from './banner-preview-card';
import Papa from 'papaparse';
import { FileUploadZone } from './file-upload-zone';
import JSZip from 'jszip';


type SheetData = Record<string, Record<string, any[]>>; // { sheetUrl -> { tabName -> [rows] } }

export function DynBannerBuilder() {
  const [parentSheetUrl, setParentSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1y86awcRSK_1MEdJ65HxhXqQQ0KPRYHhqtD_w4-Y_n3s/edit?usp=sharing');
  const [omsSheetUrl, setOmsSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1Wrg3KaCZ0XdwZ8BIScji8anjhIqr7ZAHUIQb0Qswf3g/edit?usp=sharing');
  const [baseFolderPath, setBaseFolderPath] = useState('https://s0.2mdn.net/creatives/assets/5530354/');

  const [sheetData, setSheetData] = useState<SheetData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const { toast } = useToast();

  const [selectedTier, setSelectedTier] = useState<Tier>('T1');
  const [parentTab, setParentTab] = useState('parent');
  const [creativeTab, setCreativeTab] = useState('creative_data');
  const [omsTab, setOmsTab] = useState('Jeep');
  
  const [parentIds, setParentIds] = useState('');
  const [creativeId, setCreativeId] = useState('');
  const [omsIds, setOmsIds] = useState('');


  
  const [bannerVariations, setBannerVariations] = useState<BannerVariation[]>([]);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [dynamicJsContent, setDynamicJsContent] = useState<string | null>(null);
  const [templateFileName, setTemplateFileName] = useState('');


  const availableParentTabs = useMemo(() => Object.keys(sheetData[parentSheetUrl] || {}), [sheetData, parentSheetUrl]);
  const availableOmsTabs = useMemo(() => Object.keys(sheetData[omsSheetUrl] || {}), [sheetData, omsSheetUrl]);

  const handleFetchData = async () => {
    setIsLoading(true);
    setLoadingMessage('Fetching data from Google Sheets...');
    const urls = [parentSheetUrl, omsSheetUrl];
    const newSheetData: SheetData = {};

    try {
      for (const url of urls) {
        if (!url) continue;
        newSheetData[url] = {};
        
        // This is a simplified example; a real implementation would need to parse all tabs.
        // For this case, we are fetching specific hardcoded tabs.
        const tabsToFetch = url === parentSheetUrl ? ['parent', 'creative_data'] : ['Jeep', 'Dodge', 'Ram', 'Chrysler', 'Fiat', 'AlfaRomeo'];
        
        for (const tab of tabsToFetch) {
            try {
                const response = await fetch('/api/gsheet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sheetUrl: url, sheetName: tab }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    // Don't throw error, just warn, so other tabs can still load.
                    console.warn(`Could not fetch tab "${tab}": ${error.error}`);
                    continue;
                }
                const csvText = await response.text();
                 
                const tabsToLog = ["parent", "creative_data", "Jeep"];
                if (tabsToLog.includes(tab)) {
                  const headers = csvText.split('\n')[0];
                  console.log(`--- Columns for Google Sheet tab: "${tab}" ---`);
                  console.log(headers);
                  console.log(`----------------------------------------------------`);
                }

                const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
                newSheetData[url][tab] = parsed.data;
            } catch (e) {
                 console.warn(`Error fetching or parsing tab "${tab}"`, e);
            }
        }
      }
      setSheetData(newSheetData);
      toast({ title: 'Success', description: 'Data fetched from Google Sheets.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      setSheetData({});
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };
  
  const handleTemplateUpload = async (file: File) => {
    setTemplateFile(file);
    setTemplateFileName(file.name);
    setIsLoading(true);
    setLoadingMessage('Processing template...');
    try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error('Failed to upload and process template.');
        }
        const { dynamicJsContent: djc } = await response.json();
        setDynamicJsContent(djc);
        toast({ title: 'Template Ready', description: 'Template has been processed.' });
    } catch (error) {
        setTemplateFile(null);
        setTemplateFileName('');
        toast({ title: 'Error', description: 'Could not process template file.', variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  }

  const handleGenerate = async () => {
     if (!templateFile || !dynamicJsContent) {
        toast({ title: 'Missing Template', description: 'Please upload a banner template zip file first.', variant: 'destructive' });
        return;
    }
    
    if (Object.keys(sheetData).length === 0) {
        toast({ title: 'Missing Data', description: 'Please fetch data from Google Sheets first.', variant: 'destructive' });
        return;
    }
    
    setIsLoading(true);
    setLoadingMessage('Generating banner previews...');

    try {
        const findRowById = (data: any[] | undefined, id: string): Record<string, any> | null => {
            if (!data || !id) return null;
            const trimmedId = id.trim();
            const row = data.find(r => String(r.id).trim() === trimmedId || String(r.ID).trim() === trimmedId);
            return row || null;
        }

        const creativeData = findRowById(sheetData[parentSheetUrl]?.[creativeTab], creativeId);
        if (!creativeData) throw new Error(`Could not find Creative data with ID: ${creativeId}`);

        const batchRequests = [];

        if (selectedTier === 'T1') {
            const parentIdList = parentIds.split(',').map(id => id.trim()).filter(id => id);
            if (parentIdList.length === 0) throw new Error('Please provide at least one Parent ID for T1 batch generation.');
            
            const omsData = findRowById(sheetData[omsSheetUrl]?.[omsTab], omsIds);
            if (!omsData) throw new Error(`Could not find OMS data with ID: ${omsIds}`);
            
            for (const pId of parentIdList) {
                const parentData = findRowById(sheetData[parentSheetUrl]?.[parentTab], pId);
                if (!parentData) throw new Error(`Could not find Parent data with ID: ${pId}`);
                batchRequests.push({ parentData, creativeData, omsData });
            }
        } else { // T2
            const omsIdList = omsIds.split(',').map(id => id.trim()).filter(id => id);
            if (omsIdList.length === 0) throw new Error('Please provide at least one OMS ID for T2 batch generation.');
            
            const parentData = findRowById(sheetData[parentSheetUrl]?.[parentTab], parentIds);
             if (!parentData) throw new Error(`Could not find Parent data with ID: ${parentIds}`);

            for (const oId of omsIdList) {
                const omsData = findRowById(sheetData[omsSheetUrl]?.[omsTab], oId);
                if (!omsData) throw new Error(`Could not find OMS data with ID: ${oId} in tab ${omsTab}`);
                batchRequests.push({ parentData, creativeData, omsData });
            }
        }

        if (batchRequests.length === 0) {
            throw new Error("No valid data combinations found to generate previews.");
        }


        const formData = new FormData();
        formData.append('template', templateFile);
        formData.append('dynamicJsContent', dynamicJsContent);
        formData.append('tier', selectedTier);
        formData.append('baseFolderPath', baseFolderPath);
        formData.append('batchRequest', JSON.stringify(batchRequests));
        
        const response = await fetch('/api/generate-from-sheets', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to generate banners.");
        }

        const newVariations: BannerVariation[] = await response.json();
        setBannerVariations(prev => [...prev, ...newVariations]);
        toast({ title: 'Previews Generated', description: `Added ${newVariations.length} new previews to the list.` });
        
    } catch(error) {
       const message = error instanceof Error ? error.message : 'An unknown error occurred.';
       toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }

  };
  
    const handleDownloadAll = async () => {
    if (bannerVariations.length === 0) return;
    
    setIsLoading(true);
    setLoadingMessage("Preparing all previews for download...");
    
    try {
        const zip = new JSZip();
        
        const downloadPromises = bannerVariations.map(async (variation) => {
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
                        if (!filename.startsWith('__MACOSX/')) {
                             const cleanFilename = filename.split('/').pop() || filename;
                            const fileData = await filesZip.files[filename].async('nodebuffer');
                            folder.file(cleanFilename, fileData);
                        }
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
        link.download = `Banner_Previews.zip`;
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

  const hasData = Object.keys(sheetData).length > 0;
  
  const isGenerateDisabled = isLoading || (selectedTier === 'T1' && (!parentIds || !creativeId || !omsIds)) || (selectedTier === 'T2' && (!parentIds || !creativeId || !omsIds));


  return (
    <div className="space-y-8">
      <div className="space-y-4 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">1. Connect to Google Sheets & Template</CardTitle>
            <CardDescription>
              Paste your sheet URLs, upload your banner template, and fetch the data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
                <div className="space-y-2">
                <Label htmlFor="parent-sheet-url">Parent & Creative Data Sheet URL</Label>
                <div className="flex items-center gap-2">
                    <Database className="text-muted-foreground" />
                    <Input id="parent-sheet-url" value={parentSheetUrl} onChange={e => setParentSheetUrl(e.target.value)} />
                </div>
                </div>
                <div className="space-y-2">
                <Label htmlFor="oms-sheet-url">OMS (Offers) Sheet URL</Label>
                <div className="flex items-center gap-2">
                    <Database className="text-muted-foreground" />
                    <Input id="oms-sheet-url" value={omsSheetUrl} onChange={e => setOmsSheetUrl(e.target.value)} />
                </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="base-folder-path">Base Folder Path (for images)</Label>
                    <div className="flex items-center gap-2">
                        <Folder className="text-muted-foreground" />
                        <Input id="base-folder-path" value={baseFolderPath} onChange={e => setBaseFolderPath(e.target.value)} />
                    </div>
                </div>
            </div>
             <div className="space-y-2">
                <Label>Banner Template (.zip)</Label>
                 {!templateFile ? (
                    <FileUploadZone
                        onFileUpload={handleTemplateUpload}
                        title="Upload Template"
                        description="Drag & drop a .zip file or click to select"
                        accept=".zip"
                        Icon={Archive}
                        />
                ) : (
                    <div className="flex items-center justify-center text-center p-8 border-2 border-dashed rounded-lg bg-secondary/50">
                        <div className="flex flex-col items-center gap-2 text-secondary-foreground">
                            <Archive className="w-8 h-8" />
                            <p className="font-medium">{templateFileName}</p>
                            <Button variant="link" size="sm" onClick={() => { setTemplateFile(null); setTemplateFileName(''); setDynamicJsContent(null); }}>
                                Upload a different file
                            </Button>
                        </div>
                    </div>
                )}
             </div>
          </CardContent>
           <CardFooter>
            <Button onClick={handleFetchData} disabled={isLoading} className="ml-auto">
              {isLoading && loadingMessage.includes('Fetching') ? <Loader2 className="animate-spin mr-2" /> : <Sheet className="mr-2"/>}
              Fetch Sheet Data
            </Button>
          </CardFooter>
        </Card>

        {hasData && (
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">2. Select Data by ID</CardTitle>
              <CardDescription>
                Choose the Tier, then enter the IDs to build your banner previews.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* TIER SELECTION */}
                <div className="p-4 border rounded-lg bg-background/50 space-y-3">
                    <Label className="font-medium">Select Tier</Label>
                    <RadioGroup value={selectedTier} onValueChange={(v) => setSelectedTier(v as Tier)} className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="T1" id="t1" /><Label htmlFor="t1">T1</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="T2" id="t2" /><Label htmlFor="t2">T2</Label></div>
                    </RadioGroup>
                </div>

                {/* ID SELECTION */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {/* Parent */}
                    <div className="p-4 border rounded-lg space-y-2">
                        <Label className="font-medium" htmlFor="parent-ids">Parent Data</Label>
                        <div className="flex gap-2">
                            <Select value={parentTab} onValueChange={setParentTab}>
                                <SelectTrigger><SelectValue placeholder="Select tab..." /></SelectTrigger>
                                <SelectContent>
                                    {availableParentTabs.filter(t => t === 'parent').map(tab => <SelectItem key={tab} value={tab}>{tab}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {selectedTier === 'T1' ? (
                               <Textarea id="parent-ids" placeholder="Enter comma-separated IDs..." value={parentIds} onChange={e => setParentIds(e.target.value)} />
                            ) : (
                               <Input id="parent-ids" type="text" placeholder="Enter ID" value={parentIds} onChange={e => setParentIds(e.target.value)} />
                            )}
                        </div>
                         <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1"><Info size={14}/> {selectedTier === 'T1' ? 'Enter multiple Parent IDs for batch creation.' : 'Enter a single Parent ID.'}</p>
                    </div>
                    {/* Creative */}
                     <div className="p-4 border rounded-lg space-y-2">
                        <Label className="font-medium" htmlFor="creative-id">Creative Data</Label>
                        <div className="flex gap-2">
                            <Select value={creativeTab} onValueChange={setCreativeTab}>
                                <SelectTrigger><SelectValue placeholder="Select tab..." /></SelectTrigger>
                                <SelectContent>
                                    {availableParentTabs.filter(t => t === 'creative_data').map(tab => <SelectItem key={tab} value={tab}>{tab}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Input id="creative-id" type="text" placeholder="Enter ID" value={creativeId} onChange={e => setCreativeId(e.target.value)} className="w-full" />
                        </div>
                    </div>
                </div>

                 {/* OMS */}
                 <div className="p-4 border rounded-lg space-y-2">
                    <Label className="font-medium" htmlFor="oms-ids">OMS Data</Label>
                    <div className="flex gap-2">
                        <Select value={omsTab} onValueChange={setOmsTab}>
                            <SelectTrigger><SelectValue placeholder="Select brand..." /></SelectTrigger>
                            <SelectContent>
                                {availableOmsTabs.map(tab => <SelectItem key={tab} value={tab}>{tab}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {selectedTier === 'T2' ? (
                            <Textarea id="oms-ids" placeholder="Enter comma-separated IDs..." value={omsIds} onChange={e => setOmsIds(e.target.value)} />
                        ) : (
                            <Input id="oms-ids" type="text" placeholder="Enter ID" value={omsIds} onChange={e => setOmsIds(e.target.value)} />
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1"><Info size={14}/> {selectedTier === 'T2' ? 'Enter multiple OMS IDs for batch creation.' : 'Enter a single OMS ID.'}</p>
                </div>
                 <p className="text-xs text-muted-foreground px-1">
                    Enter the value from the 'id' or 'ID' column for the data you wish to use.
                </p>
            </CardContent>
             <CardFooter>
                <Button onClick={handleGenerate} disabled={isGenerateDisabled} className="ml-auto" size="lg">
                    {isLoading && !loadingMessage.includes('Fetching') ? <Loader2 className="animate-spin mr-2" /> : <Wand2 className="mr-2" />}
                    Generate Previews
                </Button>
            </CardFooter>
          </Card>
        )}
      </div>

       {isLoading && loadingMessage && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
            <Loader2 className="animate-spin" />
            <span>{loadingMessage}</span>
        </div>
      )}

      {bannerVariations.length > 0 && (
          <div className="space-y-8 pt-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="text-3xl font-bold font-headline text-center sm:text-left">
                   Generated Previews
                </h3>
                <div className="flex items-center gap-2">
                    <Button onClick={() => setBannerVariations([])} variant="outline">
                        <RefreshCw className="mr-2" /> Clear Previews
                    </Button>
                     <Button onClick={handleDownloadAll} disabled={isLoading}>
                        <Download className="mr-2" /> Download All ({bannerVariations.length})
                    </Button>
                </div>
            </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-center">
            {bannerVariations.map((variation) => (
              <BannerPreviewCard key={variation.bannerId || variation.name} {...variation} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
