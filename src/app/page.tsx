
"use client";

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { BannerRenderGrid } from '@/components/banner-render-grid'; // CSV flow
import { DynBannerBuilder } from '@/components/dyn-banner-builder'; // GSheet flow
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { List, Database } from 'lucide-react';

export type BuildMode = 'csv' | 'gsheet';

export default function Home() {
  const [mode, setMode] = useState<BuildMode>('csv');

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto mb-8">
            <div className="text-left mb-8">
              <h2 className="text-4xl font-bold tracking-tight font-headline">
                Dyn Banner RenderGrid
              </h2>
              <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
                Create banner variations from a template and a data source.
              </p>
          </div>
          <Tabs value={mode} onValueChange={(value) => setMode(value as BuildMode)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv">
                <List className="mr-2" /> From CSV
              </TabsTrigger>
              <TabsTrigger value="gsheet">
                 <Database className="mr-2" /> From Google Sheet
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {mode === 'csv' && <BannerRenderGrid />}
        {mode === 'gsheet' && <DynBannerBuilder />}

      </main>
      <footer className="py-4 border-t">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Dyn Banner RenderGrid. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
