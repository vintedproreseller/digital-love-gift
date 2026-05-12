/**
 * POST /api/upload-image
 * Accepts a single base64-encoded image as JSON, uploads it, returns { url }.
 * Called once per photo from the browser before the main /api/create request,
 * so the main request body stays well under Vercel's 4.5 MB limit.
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';

export const dynamic = 'force-dynamic';

const cloudinaryConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { dataUrl } = body;
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return Response.json({ error: 'Missing or invalid dataUrl' }, { status: 400 });
    }

    const base64 = dataUrl.split(',')[1];
    if (!base64) return Response.json({ error: 'Malformed dataUrl' }, { status: 400 });

    const buffer = Buffer.from(base64, 'base64');
    console.log('[upload-image] buffer size:', buffer.length, 'cloudinary:', !!cloudinaryConfigured);

    let url;
    if (cloudinaryConfigured) {
      url = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'digital-love-gift', resource_type: 'image' },
          (err, result) => { if (err) reject(err); else resolve(result.secure_url); }
        );
        stream.end(buffer);
      });
    } else {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
      const fname = `${uuidv4()}.jpg`;
      await writeFile(path.join(uploadDir, fname), buffer);
      url = `/uploads/${fname}`;
    }

    console.log('[upload-image] uploaded:', url);
    return Response.json({ url });
  } catch (err) {
    console.error('[upload-image] error:', err);
    return Response.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
