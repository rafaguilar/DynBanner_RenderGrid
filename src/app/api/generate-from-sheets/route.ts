
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';

const generateUniqueId = () => `banner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const getAdSize = (htmlContent: string): { width: number, height: number } => {
    const sizeMatch = htmlContent.match(/<meta\s+name=["']ad.size["']\s+content=["']width=(\d+),\s*height=(\d+)["']/);
    if (sizeMatch && sizeMatch[1] && sizeMatch[2]) {
        return { width: parseInt(sizeMatch[1], 10), height: parseInt(sizeMatch[2], 10) };
    }
    return { width: 300, height: 250 };
}


export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        
        const templateFile = formData.get('template') as File | null;
        const dynamicJsContent = formData.get('dynamicJsContent') as string | null;
        const tier = formData.get('tier') as 'T1' | 'T2' | null;
        const baseFolderPath = formData.get('baseFolderPath') as string | null;

        const parentData = JSON.parse(formData.get('parentData') as string || '{}');
        const creativeData = JSON.parse(formData.get('creativeData') as string || '{}');
        const omsData = JSON.parse(formData.get('omsData') as string || '{}');

        if (!templateFile || !dynamicJsContent || !tier) {
            return NextResponse.json({ error: 'Missing required form data' }, { status: 400 });
        }
        
        // 1. Unpack original template to read files
        const templateBuffer = Buffer.from(await templateFile.arrayBuffer());
        const zip = await JSZip.loadAsync(templateBuffer);
        const templateFiles: Record<string, Buffer> = {};
        let htmlFile: string | null = null;
        let dynamicJsPath: string | null = null;
        
        for (const filename in zip.files) {
            if (filename.startsWith('__MACOSX/')) continue;
            const zipEntry = zip.files[filename];
            if (!zipEntry.dir) {
                const cleanFilename = path.basename(filename);
                templateFiles[cleanFilename] = await zipEntry.async('nodebuffer');
                if (cleanFilename.toLowerCase().endsWith('.html')) htmlFile = cleanFilename;
                if (cleanFilename.toLowerCase() === 'dynamic.js') dynamicJsPath = cleanFilename;
            }
        }
        if(!htmlFile) { // fallback
            for (const filename in templateFiles) {
                if(filename.toLowerCase().endsWith('.html')) {
                    htmlFile = filename;
                    break;
                }
            }
        }
        if (!dynamicJsPath) dynamicJsPath = 'Dynamic.js';


        // 2. Generate new Dynamic.js content
        let newDynamicJsContent = dynamicJsContent;

        const combinedData = {
            'parent[0]': parentData,
            'creative_data[0]': creativeData,
            'OMS[0]': omsData,
        };
        
        // Robustly replace variable values
        const jsLines = newDynamicJsContent.split('\n');

        const escapeJS = (value: any) => {
          if (value === null || value === undefined) return '';
          return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        };

        const newJsLines = jsLines.map(line => {
            let modifiedLine = line;
            for (const [objPath, dataRow] of Object.entries(combinedData)) {
                for (const key in dataRow) {
                    const fullVariablePath = `devDynamicContent.${objPath}.${key}`;
                    if (modifiedLine.includes(fullVariablePath)) {
                        let valueToSet = dataRow[key];

                        // Prepend base path if it's an image
                        if (baseFolderPath && valueToSet && typeof valueToSet === 'string' && (valueToSet.endsWith('.jpg') || valueToSet.endsWith('.png') || valueToSet.endsWith('.svg'))) {
                            valueToSet = baseFolderPath + valueToSet;
                        }

                        // Reconstruct the entire line to ensure valid syntax
                        const lineStart = modifiedLine.substring(0, modifiedLine.indexOf('=') + 1);
                        modifiedLine = `${lineStart} '${escapeJS(valueToSet)}';`;
                        break; 
                    }
                }
            }
            return modifiedLine;
        });

        // Set TIER separately to ensure it's correct
        const tierVarPath = 'devDynamicContent.parent[0].TIER';
        let tierSet = false;
        for (let i = 0; i < newJsLines.length; i++) {
            if (newJsLines[i].includes(tierVarPath)) {
                const lineStart = newJsLines[i].substring(0, newJsLines[i].indexOf('=') + 1);
                newJsLines[i] = `${lineStart} '${tier}';`;
                tierSet = true;
                break;
            }
        }

        if (!tierSet) {
            console.warn('Could not find TIER variable to set.');
        }

        newDynamicJsContent = newJsLines.join('\n');
        
        // 3. Create a new temp dir for this variation and write files
        const bannerId = generateUniqueId();
        const tmpDir = path.join(os.tmpdir(), 'banner-rendergrid-previews', bannerId);
        await fs.mkdir(tmpDir, { recursive: true });

        const newFiles = { ...templateFiles };
        if(dynamicJsPath) {
            newFiles[dynamicJsPath] = Buffer.from(newDynamicJsContent, 'utf-8');
        }


        let variationHtmlFile : string | null = null;
        let variationHtmlContent: string = '';

        for (const fileName in newFiles) {
            await fs.writeFile(path.join(tmpDir, fileName), newFiles[fileName]);
            if(fileName.toLowerCase().endsWith('.html')) {
                variationHtmlFile = fileName;
                variationHtmlContent = newFiles[fileName].toString('utf-8');
            }
        }
        if (!variationHtmlFile) { // fallback
            for (const fileName in newFiles) {
                if (fileName.toLowerCase().endsWith('.html')) {
                    variationHtmlFile = fileName;
                    variationHtmlContent = newFiles[fileName].toString('utf-8');
                    break;
                }
            }
        }

        const { width, height } = getAdSize(variationHtmlContent);
        
        const variationName = `Preview_${parentData?.id || parentData?.ID || 'data'}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '');

        const variation = {
            name: variationName,
            bannerId,
            htmlFile: variationHtmlFile || 'index.html',
            width,
            height,
        };

        return NextResponse.json(variation);

    } catch (error) {
        console.error('Generation error:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
    }
}
