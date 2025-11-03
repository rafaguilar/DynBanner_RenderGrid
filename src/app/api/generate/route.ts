
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';
import Papa from 'papaparse';

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
        const csvFile = formData.get('csv') as File | null;
        const columnMappingJSON = formData.get('columnMapping') as string | null;
        const dynamicJsContent = formData.get('dynamicJsContent') as string | null;
        const tier = formData.get('tier') as 'T1' | 'T2' | null;


        if (!templateFile || !csvFile || !columnMappingJSON || dynamicJsContent === null || !tier) {
            return NextResponse.json({ error: 'Missing required form data' }, { status: 400 });
        }
        
        const columnMapping = JSON.parse(columnMappingJSON);


        // 1. Read CSV data
        const csvFileContent = await csvFile.text();
        const parseResult = Papa.parse(csvFileContent, { header: true, skipEmptyLines: true });
        let csvData = parseResult.data as Record<string, string>[];

        // Filter CSV data based on the tier
        const tierColumn = tier === 'T1' ? 'custom_offer' : 'offerType';
        csvData = csvData.filter(row => row[tierColumn] && row[tierColumn].trim() !== '');

        if (csvData.length === 0) {
            return NextResponse.json({ error: `No rows found with data in the required column '${tierColumn}' for Tier ${tier}.` }, { status: 400 });
        }
        
        // 2. Unpack original template to read files
        const templateBuffer = Buffer.from(await templateFile.arrayBuffer());
        const zip = await JSZip.loadAsync(templateBuffer);
        const templateFiles: Record<string, Buffer> = {};
        let htmlFile: string | null = null;

        for (const filename in zip.files) {
             // Skip macOS-specific metadata files
            if (filename.startsWith('__MACOSX/')) {
                continue;
            }
            const zipEntry = zip.files[filename];
            if (!zipEntry.dir) {
                const cleanFilename = path.basename(filename);
                templateFiles[cleanFilename] = await zipEntry.async('nodebuffer');
                if (cleanFilename.toLowerCase().endsWith('.html')) {
                    htmlFile = cleanFilename;
                }
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

        // 3. Generate variations
        const variations = await Promise.all(csvData.map(async (row, index) => {
            let newDynamicJsContent = dynamicJsContent;
            
            // Standard mapping
            for (const csvColumn in columnMapping) {
                if (row[csvColumn] && columnMapping[csvColumn]) {
                     // Tier-based logic is handled separately below
                    if (csvColumn === 'custom_offer' || csvColumn === 'offerType') continue;

                    const jsVariablePath = columnMapping[csvColumn];
                    const valueToSet = row[csvColumn];

                    const regex = new RegExp(`(${jsVariablePath.replace(/\[/g, '\\[').replace(/\]/g, '\\]')}\\s*=\\s*['"])([^'"]*)(['"]?)`);
                    if (regex.test(newDynamicJsContent)) {
                        newDynamicJsContent = newDynamicJsContent.replace(regex, `$1${valueToSet}$3`);
                    } else {
                        console.warn(`Could not find "${jsVariablePath}" in Dynamic.js to replace.`);
                    }
                }
            }

            // Tier-specific mapping for custom_offer
            const offerJsVariablePath = 'devDynamicContent.parent[0].custom_offer';
            let offerValueToSet = '';
            
            if (tier === 'T1') {
                offerValueToSet = row['custom_offer'];
            } else if (tier === 'T2') {
                offerValueToSet = row['offerType'];
            }

            if(offerValueToSet) {
                 const regex = new RegExp(`(${offerJsVariablePath.replace(/\[/g, '\\[').replace(/\]/g, '\\]')}\\s*=\\s*['"])([^'"]*)(['"]?)`);
                 if (regex.test(newDynamicJsContent)) {
                    newDynamicJsContent = newDynamicJsContent.replace(regex, `$1${offerValueToSet}$3`);
                } else {
                    console.warn(`Could not find "${offerJsVariablePath}" in Dynamic.js to replace for tier logic.`);
                }
            }


            const variationName = `Variation_${index + 1}_${
                row[Object.keys(row)[0]] || "data"
              }`.replace(/[^a-zA-Z0-9_-]/g, '');

            const newFiles = { ...templateFiles };
            const dynamicJsPath = Object.keys(newFiles).find(p => p.toLowerCase().endsWith('dynamic.js')) || 'Dynamic.js';
            newFiles[dynamicJsPath] = Buffer.from(newDynamicJsContent, 'utf-8');

            // 4. Create a new temp dir for this variation and write files
            const bannerId = generateUniqueId();
            const tmpDir = path.join(os.tmpdir(), 'banner-rendergrid-previews', bannerId);
            await fs.mkdir(tmpDir, { recursive: true });

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

            return {
                name: variationName,
                bannerId,
                htmlFile: variationHtmlFile || 'index.html',
                width,
                height,
            };
        }));

        return NextResponse.json(variations);

    } catch (error) {
        console.error('Generation error:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
    }
}
