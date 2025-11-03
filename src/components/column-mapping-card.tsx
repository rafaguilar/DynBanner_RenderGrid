
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { Check, Loader2 } from "lucide-react";
import type { Tier } from "./banner-render-grid";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";

type ColumnMapping = Record<string, string>;

interface ColumnMappingCardProps {
  csvColumns: string[];
  jsVariables: string[];
  initialMapping: ColumnMapping;
  onMappingConfirm: (mapping: ColumnMapping, tier: Tier) => void;
  detectedTier: Tier | null;
  isAiMappingRunning: boolean;
}

export const ColumnMappingCard: React.FC<ColumnMappingCardProps> = ({
  csvColumns,
  jsVariables,
  initialMapping,
  onMappingConfirm,
  detectedTier,
  isAiMappingRunning
}) => {
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);

  useEffect(() => {
    // When detectedTier is available, set it as the default selected tier
    if (detectedTier) {
      setSelectedTier(detectedTier);
    }
  }, [detectedTier]);
  
  useEffect(() => {
    // When the initial mapping from AI is available, populate the local mapping state.
    if(initialMapping) {
      setMapping(initialMapping);
    }
  }, [initialMapping]);

  const handleMappingChange = (csvColumn: string, jsVariable: string) => {
    const valueToSet = jsVariable === "none" ? "" : jsVariable;
    setMapping((prev) => ({ ...prev, [csvColumn]: valueToSet }));
  };
  
  const handleConfirm = () => {
    if (!selectedTier) {
        // Optionally, show a toast or message to select a tier.
        return;
    }
    
    // Create the final mapping object to be sent
    const finalMapping: ColumnMapping = { ...mapping };

    // This is the crucial fix: Ensure that the mapping for both tier-specific
    // columns is correctly set based on the selected tier, even if one is hidden.
    const customOfferVar = jsVariables.find(v => v.includes('custom_offer'));

    if(customOfferVar) {
        if(selectedTier === 'T1') {
            finalMapping['custom_offer'] = customOfferVar;
            finalMapping['offerType'] = ''; // Ensure the other tier's mapping is cleared
        } else { // T2
            finalMapping['offerType'] = customOfferVar;
            finalMapping['custom_offer'] = ''; // Ensure the other tier's mapping is cleared
        }
    }

    // Filter out any empty mappings before confirming
    const cleanedMapping: ColumnMapping = {};
    for (const key in finalMapping) {
        if (Object.prototype.hasOwnProperty.call(finalMapping, key) && finalMapping[key]) {
             cleanedMapping[key] = finalMapping[key];
        }
    }

    onMappingConfirm(cleanedMapping, selectedTier);
  };

  const visibleCsvColumns = useMemo(() => {
    if (!selectedTier) return [];

    // Always show columns that are not tier-specific
    return csvColumns.filter(col => col !== 'custom_offer' && col !== 'offerType');
    
  }, [selectedTier, csvColumns]);
  
  const tierSpecificColumn = useMemo(() => {
    if (!selectedTier) return null;
    return selectedTier === 'T1' ? 'custom_offer' : 'offerType';
  }, [selectedTier]);


  if (csvColumns.length === 0) {
    return null; 
  }

  const customOfferVar = jsVariables.find(v => v.includes('custom_offer'));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
            3
          </div>
          <div>
            <CardTitle className="font-headline">Map Columns</CardTitle>
            <CardDescription>
              First select the Tier, then match CSV columns to your template's JavaScript variables.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border rounded-lg bg-background/50 space-y-3">
        <Label className="font-medium">Select Tier for Generation</Label>
        <RadioGroup value={selectedTier ?? ""} onValueChange={(value) => setSelectedTier(value as Tier)} className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="T1" id="t1" />
                <Label htmlFor="t1">T1</Label>
            </div>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="T2" id="t2" />
                <Label htmlFor="t2">T2</Label>
            </div>
        </RadioGroup>
        <p className="text-xs text-muted-foreground">This determines which offer column from your CSV is used.</p>
        </div>

        {(isAiMappingRunning || !selectedTier) ? (
             <div className="flex items-center justify-center gap-2 text-muted-foreground py-10">
                <Loader2 className="animate-spin" />
                <span>{isAiMappingRunning ? "AI is suggesting mappings..." : "Select a Tier to continue..."}</span>
            </div>
        ) : (
            <div className="border rounded-lg overflow-hidden">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>CSV Column</TableHead>
                    <TableHead>JavaScript Variable</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {/* Tier-specific row shown at the top */}
                    {tierSpecificColumn && csvColumns.includes(tierSpecificColumn) && customOfferVar && (
                      <TableRow key={tierSpecificColumn} className="bg-primary/5">
                        <TableCell className="font-medium">{tierSpecificColumn} <Badge variant="outline" className="ml-2">Auto-mapped</Badge></TableCell>
                        <TableCell>
                          <Select
                              value={customOfferVar}
                              disabled
                          >
                              <SelectTrigger>
                              <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value={customOfferVar}>
                                  {customOfferVar}
                                  </SelectItem>
                              </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Other mappable columns */}
                    {visibleCsvColumns.map((col) => (
                    <TableRow key={col}>
                        <TableCell className="font-medium">{col}</TableCell>
                        <TableCell>
                        <Select
                            value={mapping[col] || "none"}
                            onValueChange={(value) => handleMappingChange(col, value)}
                        >
                            <SelectTrigger>
                            <SelectValue placeholder="Select a variable" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="none">
                                <em>None</em>
                            </SelectItem>
                            {jsVariables && jsVariables.length > 0 && jsVariables.map((variable) => (
                                <SelectItem key={variable} value={variable}>
                                {variable}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleConfirm} className="ml-auto" disabled={!selectedTier || isAiMappingRunning}>
          <Check className="mr-2" /> Confirm Mapping
        </Button>
      </CardFooter>
    </Card>
  );
};

    