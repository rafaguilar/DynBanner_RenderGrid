
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
    setMapping(initialMapping);
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
    const finalMapping: ColumnMapping = {};
     for (const key in mapping) {
        if (Object.prototype.hasOwnProperty.call(mapping, key) && mapping[key]) {
             finalMapping[key] = mapping[key];
        }
    }
    onMappingConfirm(finalMapping, selectedTier);
  };

  const visibleCsvColumns = useMemo(() => {
    if (!selectedTier) return [];

    const otherCols = csvColumns.filter(col => col !== 'custom_offer' && col !== 'offerType');
    
    if (selectedTier === "T1" && csvColumns.includes('custom_offer')) {
        return ['custom_offer', ...otherCols];
    } else if (selectedTier === "T2" && csvColumns.includes('offerType')) {
        return ['offerType', ...otherCols];
    }
    return otherCols;
  }, [selectedTier, csvColumns]);

  if (csvColumns.length === 0) {
    return null; 
  }

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
        {detectedTier && (
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
            <p className="text-xs text-muted-foreground">Changes which CSV columns are used for generation.</p>
            </div>
        )}

        {(isAiMappingRunning || !selectedTier) ? (
             <div className="flex items-center justify-center gap-2 text-muted-foreground py-10">
                <Loader2 className="animate-spin" />
                <span>{isAiMappingRunning ? "AI is mapping columns..." : "Select a Tier to see column mappings..."}</span>
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

    