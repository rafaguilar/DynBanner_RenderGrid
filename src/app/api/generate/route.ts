
import { NextRequest, NextResponse } from 'next/server';
import formidable from 'formidable';
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

const parseForm = (req: NextRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
    return new Promise((resolve, reject) => {
        const form = formidable({});
        form.parse(req as any, (err, fields, files) => {
            if (err) reject(err);
            else resolve({ fields, files });
        });
    });
};

export async function POST(req: NextRequest) {
    try {
        const { fields, files } = await parseForm(req);
        
        const templateFile = files.template?.[0];
        const csvFile = files.csv?.[0];
        const columnMapping = JSON.parse(fields.columnMapping?.[0] || '{}');
        const dynamicJsContent = fields.dynamicJsContent?.[0] || '';

        if (!templateFile || !csvFile) {
            return NextResponse.json({ error: 'Missing template or csv file' }, { status: 400 });
        }

        // 1. Read CSV data
        const csvFileContent = await fs.readFile(csvFile.filepath, 'utf-8');
        const parseResult = Papa.parse(csvFileContent, { header: true, skipEmptyLines: true });
        const csvData = parseResult.data as Record<string, string>[];
        
        // 2. Unpack original template to read files
        const templateBuffer = await fs.readFile(templateFile.filepath);
        const zip = await JSZip.loadAsync(templateBuffer);
        const templateFiles: Record<string, Buffer> = {};
        let htmlFile: string | null = null;

        for (const filename in zip.files) {
            const zipEntry = zip.files[filename];
            if (!zipEntry.dir) {
                templateFiles[filename] = await zipEntry.async('nodebuffer');
                if (filename.toLowerCase().endsWith('.html')) {
                    htmlFile = filename;
                }
            }
        }
        if(!htmlFile) { // fallback
            for (const filename in zip.files) {
                if(filename.toLowerCase().endsWith('.html')) {
                    htmlFile = filename;
                    break;
                }
            }
        }

        // 3. Generate variations
        const variations = await Promise.all(csvData.map(async (row, index) => {
            let newDynamicJsContent = dynamicJsContent;
            
            for (const csvColumn in columnMapping) {
                if (row[csvColumn] && columnMapping[csvColumn]) {
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

            const variationName = `Variation_${index + 1}_${
                row[Object.keys(row)[0]] || "data"
              }`.replace(/[^a-zA-Z0-9_-]/g, '');

            const newFiles = { ...templateFiles };
            const dynamicJsPath = Object.keys(newFiles).find(p => p.toLowerCase().endsWith('dynamic.js')) || 'Dynamic.js';
            newFiles[dynamicJsPath] = Buffer.from(newDynamicJsContent, 'utf-8');

            // 4. Create a new temp dir for this variation and write files
            const bannerId = generateUniqueId();
            const tmpDir = path.join(os.tmpdir(), 'bannerbuildr-previews', bannerId);
            await fs.mkdir(tmpDir, { recursive: true });

            let variationHtmlFile : string | null = null;
            let variationHtmlContent: string = '';

            for (const fileName in newFiles) {
                await fs.writeFile(path.join(tmpDir, path.basename(fileName)), newFiles[fileName]);
                if(fileName.toLowerCase().endsWith('.html')) {
                    variationHtmlFile = path.basename(fileName);
                    variationHtmlContent = newFiles[fileName].toString('utf-8');
                }
            }
            if (!variationHtmlFile) { // fallback
                 for (const fileName in newFiles) {
                    if (fileName.toLowerCase().endsWith('.html')) {
                        variationHtmlFile = path.basename(fileName);
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
