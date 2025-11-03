
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import mime from 'mime-types';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  try {
    const { slug } = params;
    if (!slug || slug.length < 2) {
      return new NextResponse('Invalid path', { status: 400 });
    }

    const [bannerId, ...filePathParts] = slug;
    const requestedFile = filePathParts.join('/');

    // Basic security check to prevent directory traversal
    if (bannerId.includes('..') || requestedFile.includes('..')) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const tempBaseDir = path.join(os.tmpdir(), 'bannerbuildr-previews');
    const bannerDir = path.join(tempBaseDir, bannerId);
    const absoluteFilePath = path.join(bannerDir, requestedFile);

    // Security: Ensure the resolved path is still within the intended directory
    if (!absoluteFilePath.startsWith(bannerDir)) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const fileContent = await fs.readFile(absoluteFilePath);
    const contentType = mime.lookup(absoluteFilePath) || 'application/octet-stream';

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileContent.length.toString(),
      },
    });

  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return new NextResponse('File not found', { status: 404 });
    }
    console.error('File serving error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
