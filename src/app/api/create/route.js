/**
 * POST /api/create
 * Handles multipart form data, uploads images to Cloudinary, calls AI, saves to DB
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import { generateGiftContent } from '@/lib/ai';
import { saveGift } from '@/lib/db';
import { hashPassword } from '@/lib/password';

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

async function uploadImage(buffer) {
  if (cloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'digital-love-gift', resource_type: 'image' },
        (err, result) => { if (err) reject(err); else resolve(result.secure_url); }
      );
      stream.end(buffer);
    });
  }
  // Local fallback for dev (not available on Vercel)
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
  const filename = `${uuidv4()}.jpg`;
  await writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/${filename}`;
}

export async function POST(request) {
  try {
    const formData = await request.formData();

    // Parse fields
    const partnerName      = formData.get('partnerName');
    const occasion         = formData.get('occasion');
    const tone             = formData.get('tone');
    const song             = formData.get('song') || '';
    const songUrl          = formData.get('songUrl') || '';
    const relationshipDate = formData.get('relationshipDate') || '';
    const password         = formData.get('password') || '';

    const memory1 = formData.get('memory1');
    const memory2 = formData.get('memory2');
    const memory3 = formData.get('memory3');
    const trait1  = formData.get('trait1');
    const trait2  = formData.get('trait2');
    const trait3  = formData.get('trait3');

    // Timeline (optional)
    const timeline = [
      { date: formData.get('timelineDate1'), event: formData.get('timelineEvent1') },
      { date: formData.get('timelineDate2'), event: formData.get('timelineEvent2') },
      { date: formData.get('timelineDate3'), event: formData.get('timelineEvent3') },
    ].filter(t => t.date && t.event);

    if (!partnerName || !occasion || !tone) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Handle image uploads
    const imageFiles  = formData.getAll('images');
    const savedImages = [];

    for (const file of imageFiles) {
      if (!file || typeof file === 'string' || file.size === 0) continue;
      if (savedImages.length >= 5) break;

      const ext     = file.name.split('.').pop().toLowerCase();
      const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      if (!allowed.includes(ext)) continue;
      if (file.size > 5 * 1024 * 1024) continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const url    = await uploadImage(buffer);
      savedImages.push(url);
    }

    const giftFormData = {
      partnerName,
      occasion,
      tone,
      song,
      songUrl,
      relationshipDate,
      memories: [memory1, memory2, memory3],
      traits:   [trait1, trait2, trait3],
      timeline,
    };

    // Call Claude
    const aiContent = await generateGiftContent(giftFormData);
    const giftId    = uuidv4();

    const gift = {
      id:                  giftId,
      formData:            giftFormData,
      images:              savedImages,
      content:             aiContent,
      passwordHash:        password ? hashPassword(password) : null,
      isPasswordProtected: !!password,
    };

    await saveGift(gift);

    return Response.json({ success: true, giftId });
  } catch (err) {
    console.error('Create error:', err);
    return Response.json({ error: err.message || 'Failed to create gift' }, { status: 500 });
  }
}
