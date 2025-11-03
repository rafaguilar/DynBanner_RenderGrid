
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import JSZip from 'jszip';

export async function GET(
  req: NextRequest,
  { params }: { params: { bannerId: string } }
) {
  try {
    const { bannerId } = params;
    if (!bannerId) {
      return new NextResponse('Invalid banner ID', { status: 400 });
    }
    
    if (bannerId.includes('..')) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const tempBaseDir = path.join(os.tmpdir(), 'bannerbuildr-previews');
    const bannerDir = path.join(tempBaseDir, bannerId);

    const files = await fs.readdir(bannerDir);
    const zip = new JSZip();

    for (const file of files) {
        const filePath = path.join(bannerDir, file);
        const content = await fs.readFile(filePath);
        zip.file(file, content);
    }
    
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${bannerId}.zip"`,
      },
    });

  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return new NextResponse('Banner files not found', { status: 404 });
    }
    console.error('Download error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
