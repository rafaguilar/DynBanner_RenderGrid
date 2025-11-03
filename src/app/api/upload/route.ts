
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';

// Disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to generate a unique ID
const generateUniqueId = () => `banner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper to get ad size from HTML content
const getAdSize = (htmlContent: string): { width: number, height: number } => {
    const sizeMatch = htmlContent.match(/<meta\s+name=["']ad.size["']\s+content=["']width=(\d+),\s*height=(\d+)["']/);
    if (sizeMatch && sizeMatch[1] && sizeMatch[2]) {
        return { width: parseInt(sizeMatch[1], 10), height: parseInt(sizeMatch[2], 10) };
    }
    return { width: 300, height: 250 }; // Default size
}

const getTier = (jsContent: string | null): 'T1' | 'T2' | null => {
    if (!jsContent) return null;
    const tierMatch = jsContent.match(/devDynamicContent\.parent\[0\]\.TIER\s*=\s*["'](T[12])["']/);
    if (tierMatch && tierMatch[1]) {
        return tierMatch[1] as 'T1' | 'T2';
    }
    return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const bannerId = generateUniqueId();
    const tmpDir = path.join(os.tmpdir(), 'banner-rendergrid-previews', bannerId);
    await fs.mkdir(tmpDir, { recursive: true });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    const zip = await JSZip.loadAsync(fileBuffer);
    
    let htmlFile: string | null = null;
    let dynamicJsContent: string | null = null;
    let htmlContent: string | null = null;

    for (const filename in zip.files) {
      // Skip macOS-specific metadata files
      if (filename.startsWith('__MACOSX/')) {
        continue;
      }
      
      const zipEntry = zip.files[filename];
      if (!zipEntry.dir) {
        const content = await zipEntry.async('nodebuffer');
        const cleanFilename = path.basename(filename);
        const filePath = path.join(tmpDir, cleanFilename);
        await fs.writeFile(filePath, content);

        if (cleanFilename.toLowerCase().endsWith('.html')) {
          htmlFile = cleanFilename;
          htmlContent = content.toString('utf-8');
        } else if (cleanFilename.toLowerCase().endsWith('dynamic.js')) {
          dynamicJsContent = content.toString('utf-8');
        }
      }
    }
    
    // Fallback if index.html is not found
    if (!htmlFile) {
        for (const filename in zip.files) {
             const cleanFilename = path.basename(filename);
            if (!filename.startsWith('__MACOSX/') && cleanFilename.toLowerCase().endsWith('.html') && !zip.files[filename].dir) {
                htmlFile = cleanFilename;
                htmlContent = await zip.file(filename)!.async('string');
                break;
            }
        }
    }

    if (!htmlFile || !htmlContent) {
      await fs.rm(tmpDir, { recursive: true, force: true });
      return NextResponse.json({ error: 'No HTML file found in the zip archive.' }, { status: 400 });
    }

    const { width, height } = getAdSize(htmlContent);
    const tier = getTier(dynamicJsContent);

    return NextResponse.json({ bannerId, htmlFile, dynamicJsContent, width, height, tier });

  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
