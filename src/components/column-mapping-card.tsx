
"use client";

import { useState, useEffect } from "react";
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
import { Check } from "lucide-react";

type ColumnMapping = Record<string, string>;

interface ColumnMappingCardProps {
  csvColumns: string[];
  jsVariables: string[];
  initialMapping: ColumnMapping;
  onMappingConfirm: (mapping: ColumnMapping) => void;
}

export const ColumnMappingCard: React.FC<ColumnMappingCardProps> = ({
  csvColumns,
  jsVariables,
  initialMapping,
  onMappingConfirm,
}) => {
  const [mapping, setMapping] = useState<ColumnMapping>({});

  useEffect(() => {
    // When the csvColumns to display change (e.g. tier switch),
    // rebuild the mapping state from the initial AI suggestion,
    // but only for the columns that are currently relevant.
    const newMapping: ColumnMapping = {};
    csvColumns.forEach(col => {
        if (initialMapping[col]) {
            newMapping[col] = initialMapping[col];
        }
    });
    setMapping(newMapping);
  }, [initialMapping, csvColumns]);

  const handleMappingChange = (csvColumn: string, jsVariable: string) => {
    const valueToSet = jsVariable === "none" ? "" : jsVariable;
    setMapping((prev) => ({ ...prev, [csvColumn]: valueToSet }));
  };
  
  const handleConfirm = () => {
    // When confirming, pass up only the mappings for the currently visible columns.
    const finalMapping: ColumnMapping = {};
     for (const key in mapping) {
        if (Object.prototype.hasOwnProperty.call(mapping, key) && mapping[key]) {
             finalMapping[key] = mapping[key];
        }
    }
    // Also include mappings from the initial AI suggestion that might not be in the current view
    // but are still relevant (e.g. other non-tier-specific columns)
    for (const key in initialMapping) {
        if(!finalMapping[key]) {
            finalMapping[key] = initialMapping[key];
        }
    }

    onMappingConfirm(finalMapping);
  };

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
              Match CSV columns to your template's JavaScript variables. We've
              made some suggestions with AI.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>CSV Column</TableHead>
                <TableHead>JavaScript Variable</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {csvColumns.map((col) => (
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
      </CardContent>
      <CardFooter>
        <Button onClick={handleConfirm} className="ml-auto">
          <Check className="mr-2" /> Confirm Mapping
        </Button>
      </CardFooter>
    </Card>
  );
};

    