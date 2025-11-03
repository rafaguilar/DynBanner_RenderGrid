
import { NextRequest, NextResponse } from 'next/server';
import formidable from 'formidable';
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
    const sizeMatch = htmlContent.match(/<meta\s+name=["']ad.size["']\s+content=["']width=(\d+),height=(\d+)["']/);
    if (sizeMatch && sizeMatch[1] && sizeMatch[2]) {
        return { width: parseInt(sizeMatch[1], 10), height: parseInt(sizeMatch[2], 10) };
    }
    return { width: 300, height: 250 }; // Default size
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const bannerId = generateUniqueId();
    const tmpDir = path.join(os.tmpdir(), 'bannerbuildr-previews', bannerId);
    await fs.mkdir(tmpDir, { recursive: true });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    const zip = await JSZip.loadAsync(fileBuffer);
    
    let htmlFile: string | null = null;
    let dynamicJsContent: string | null = null;
    let htmlContent: string | null = null;

    for (const filename in zip.files) {
      const zipEntry = zip.files[filename];
      if (!zipEntry.dir) {
        const content = await zipEntry.async('nodebuffer');
        const filePath = path.join(tmpDir, path.basename(filename)); // Use basename to flatten structure
        await fs.writeFile(filePath, content);

        if (filename.toLowerCase().endsWith('index.html')) {
          htmlFile = path.basename(filename);
          htmlContent = await zipEntry.async('string');
        } else if (filename.toLowerCase().endsWith('dynamic.js')) {
          dynamicJsContent = await zipEntry.async('string');
        }
      }
    }
    
    // Fallback if index.html is not found
    if (!htmlFile) {
        for (const filename in zip.files) {
            if (filename.toLowerCase().endsWith('.html')) {
                htmlFile = path.basename(filename);
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

    return NextResponse.json({ bannerId, htmlFile, dynamicJsContent, width, height });

  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
