/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ S3 SERVICE — File Storage via AWS S3
 * ═══════════════════════════════════════════════════════════
 *
 *  Pattern: presigned URLs — the browser uploads directly to S3.
 *  The server never proxies file bytes; it only signs short-lived URLs.
 *
 *  Flow:
 *  1. Client calls POST /api/v1/upload/presign → gets { uploadUrl, key }
 *  2. Client PUTs the file directly to uploadUrl (no server involved)
 *  3. Client calls PUT /api/v1/users/me/photo with { key } to save it
 *
 *  No-op / graceful when AWS env vars are not set.
 *  Sign up at aws.amazon.com → S3 → create bucket → IAM user with S3 access
 * ═══════════════════════════════════════════════════════════
 */

import {
    S3Client,
    DeleteObjectCommand,
    HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const REGION  = process.env.AWS_REGION  || 'ap-south-1';   // Mumbai — closest to Chennai
const BUCKET  = process.env.AWS_S3_BUCKET || '';

const s3 = BUCKET
    ? new S3Client({
          region: REGION,
          credentials: {
              accessKeyId:     process.env.AWS_ACCESS_KEY_ID     || '',
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
          },
      })
    : null;

function isReady(): boolean {
    return !!s3 && !!BUCKET;
}

// ─── Allowed upload types ────────────────────────────────

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
    'image/jpeg':       'jpg',
    'image/png':        'png',
    'image/webp':       'webp',
    'application/pdf':  'pdf',
};

export function isAllowedContentType(ct: string): boolean {
    return ct in ALLOWED_CONTENT_TYPES;
}

export function extForContentType(ct: string): string {
    return ALLOWED_CONTENT_TYPES[ct] || 'bin';
}

// ─── Key builders ────────────────────────────────────────

export function profilePhotoKey(userId: string, ext: string): string {
    return `users/${userId}/profile.${ext}`;
}

export function providerDocKey(providerId: string, docType: string, ext: string): string {
    return `providers/${providerId}/${docType}-${Date.now()}.${ext}`;
}

// ─── Presigned upload URL (PUT, 15 min) ─────────────────

export async function getPresignedUploadUrl(
    key: string,
    contentType: string
): Promise<string> {
    if (!isReady()) {
        console.log(`[S3] (no-op) presign upload: ${key}`);
        return `https://mock-s3-upload.example.com/${key}`;
    }

    const cmd = new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         key,
        ContentType: contentType,
    });

    return getSignedUrl(s3!, cmd, { expiresIn: 15 * 60 });
}

// ─── Presigned view URL (GET, 1 hour) ───────────────────

export async function getPresignedViewUrl(key: string): Promise<string> {
    if (!isReady()) {
        return `https://mock-s3-cdn.example.com/${key}`;
    }

    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(s3!, cmd, { expiresIn: 60 * 60 });
}

// ─── Delete a file ──────────────────────────────────────

export async function deleteFile(key: string): Promise<void> {
    if (!isReady()) {
        console.log(`[S3] (no-op) delete: ${key}`);
        return;
    }

    await s3!.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    console.log(`[S3] Deleted: ${key}`);
}

// ─── Check if a key exists ──────────────────────────────

export async function fileExists(key: string): Promise<boolean> {
    if (!isReady()) return false;
    try {
        await s3!.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        return true;
    } catch {
        return false;
    }
}
