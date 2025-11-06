
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
        
        // Force set the TIER first
        const tierRegex = new RegExp(`(devDynamicContent\\.parent\\[0\\]\\.TIER\\s*=\\s*['"])([^'"]*)(['"]?)`);
        if (tierRegex.test(newDynamicJsContent)) {
             newDynamicJsContent = newDynamicJsContent.replace(tierRegex, `$1${tier}$3`);
        }


        // Robustly replace variable values
        for (const [objPath, dataRow] of Object.entries(combinedData)) {
            for (const key in dataRow) {
                 const value = dataRow[key];
                 if (value === undefined || value === null) continue;
                 
                 const fullVariablePath = `devDynamicContent.${objPath}.${key}`;
                 
                 // Escape special characters in the variable path for use in the regex
                 const escapedVarPath = fullVariablePath.replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\./g, '\\.');

                 // Regex to find the variable assignment and replace its value
                 // It handles single quotes, double quotes, or no quotes for the original value
                 const regex = new RegExp(`(${escapedVarPath}\\s*=\\s*)(?:['"]?)(.*?)(?:['"]?)(;.*|$)`, 'm');

                 if (regex.test(newDynamicJsContent)) {
                     const escapedValue = String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                     newDynamicJsContent = newDynamicJsContent.replace(regex, `$1'${escapedValue}'$3`);
                 } else {
                     console.warn(`Could not find "${fullVariablePath}" in Dynamic.js to perform replacement.`);
                 }
            }
        }
        
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
