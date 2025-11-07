
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

// Helper to safely create a JS string literal.
const safeStringify = (value: any): string => {
    if (value === null || value === undefined) return "''";
    // Using JSON.stringify is the most robust way to escape characters for JS.
    return JSON.stringify(String(value));
}


export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        
        const templateFile = formData.get('template') as File | null;
        const dynamicJsContent = formData.get('dynamicJsContent') as string | null;
        const tier = formData.get('tier') as 'T1' | 'T2' | null;
        const baseFolderPath = formData.get('baseFolderPath') as string | null;
        const batchRequest = formData.get('batchRequest') as string | null;
        
        if (!templateFile || !dynamicJsContent || !tier || !batchRequest) {
            return NextResponse.json({ error: 'Missing required form data' }, { status: 400 });
        }

        const batchData = JSON.parse(batchRequest);
        const variations: any[] = [];

        // 1. Unpack original template to read files ONCE
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


        for (const data of batchData) {
            const { parentData, creativeData, omsData } = data;
            
            // 2. Generate new Dynamic.js content FOR THIS VARIATION
            let newDynamicJsContent = dynamicJsContent;

            const combinedData = {
                'parent[0]': parentData,
                'creative_data[0]': creativeData,
                'OMS[0]': omsData,
            };
            
            const jsLines = newDynamicJsContent.split('\n');

            const newJsLines = jsLines.map(line => {
                let modifiedLine = line;
                // Iterate over each data object (parent, creative, oms)
                for (const [objPath, dataRow] of Object.entries(combinedData)) {
                     if (!dataRow) continue;
                     // Iterate over each key/value pair in the data row
                    for (const key in dataRow) {
                        const valueToSet = dataRow[key];

                        // SPECIAL HANDLING for complex JSON strings, ONLY for T2
                         if (tier === 'T2' && (key === 'customGroups' || key === 'rd_values' || key === 'rd-values')) {
                            const varPath = `devDynamicContent.${objPath}.${key}`;
                            const regex = new RegExp(`(${varPath.replace(/\[/g, '\\[').replace(/\]/g, '\\]')}\\s*=\\s*).*;`);
                            if (regex.test(modifiedLine)) {
                                // The value from the sheet is already a stringified JSON. We stringify it *again*
                                // to create a valid JavaScript string literal containing the original stringified JSON.
                                modifiedLine = modifiedLine.replace(regex, `$1${JSON.stringify(valueToSet || '[]')};`);
                                return modifiedLine; // Exit early, line is processed.
                            }
                        }

                        // Regular handling for all other keys
                        const varPath = `devDynamicContent.${objPath}.${key}`;
                        const regex = new RegExp(`(${varPath.replace(/\[/g, '\\[').replace(/\]/g, '\\]')}\\s*=\\s*).*;`);
                        
                        if (regex.test(modifiedLine)) {
                            const trimmedValue = String(valueToSet || '').trim();
                            const isImage = trimmedValue.endsWith('.jpg') || trimmedValue.endsWith('.png') || trimmedValue.endsWith('.svg');
                            
                            if (isImage) {
                                 const imageVarPath = `${varPath}.Url`;
                                 const imageRegex = new RegExp(`(${imageVarPath.replace(/\[/g, '\\[').replace(/\]/g, '\\]')}\\s*=\\s*).*;`);
                                 if (imageRegex.test(line)) {
                                    let finalUrl = trimmedValue;
                                    if (baseFolderPath && !trimmedValue.startsWith('http')) {
                                        finalUrl = baseFolderPath + trimmedValue;
                                    }
                                    modifiedLine = line.replace(imageRegex, `$1${safeStringify(finalUrl)};`);
                                    return modifiedLine; // Exit early
                                 }
                            } else {
                                modifiedLine = line.replace(regex, `$1${safeStringify(valueToSet)};`);
                                return modifiedLine; // Exit early
                            }
                        }
                    }
                }
                return modifiedLine; // Return original line if no match
            });
            
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
            
            const parentId = parentData?.id || parentData?.ID || 'data';
            const omsId = omsData?.id || omsData?.ID || '';
            const customOffer = parentData?.custom_offer || '';
            const timestamp = Date.now().toString().slice(-6);

            const variationName = `Preview_${parentId}_${omsId || customOffer}_${timestamp}`.replace(/[^a-zA-Z0-9_-]/g, '');

            variations.push({
                name: variationName,
                bannerId,
                htmlFile: variationHtmlFile || 'index.html',
                width,
                height,
            });
        }

        return NextResponse.json(variations);

    } catch (error) {
        console.error('Generation error:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
    }
}
