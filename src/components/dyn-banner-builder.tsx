
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Wand2, Loader2, Database } from 'lucide-react';

export function DynBannerBuilder() {
  const [isLoading, setIsLoading] = useState(false);
  
  return (
    <div className="space-y-8">
       <div className="space-y-4 max-w-4xl mx-auto">
         <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg`}>
                  1
              </div>
              <div>
                <CardTitle className="font-headline">Connect to Google Sheets</CardTitle>
                <CardDescription>Paste the URLs of your public Google Sheets to start.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parent-sheet-url">Parent & Creative Data Sheet</Label>
              <div className="flex items-center gap-2">
                <Database className="text-muted-foreground" />
                <Input id="parent-sheet-url" placeholder="https://docs.google.com/spreadsheets/d/..." />
              </div>
            </div>
             <div className="space-y-2">
              <Label htmlFor="oms-sheet-url">OMS (T2 Offers) Sheet</Label>
               <div className="flex items-center gap-2">
                <Database className="text-muted-foreground" />
                <Input id="oms-sheet-url" placeholder="https://docs.google.com/spreadsheets/d/..." />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

       {isLoading && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin" />
            <span>Loading...</span>
        </div>
      )}

    </div>
  );
}
