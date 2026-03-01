/**
 * ═══════════════════════════════════════════════════════════
 *  MOVZZ UPLOAD CONTROLLER
 * ═══════════════════════════════════════════════════════════
 *
 *  POST /api/v1/upload/presign   — get a signed URL to upload to S3
 *  PUT  /api/v1/users/me/photo   — save the S3 key after upload
 *  GET  /api/v1/users/me         — current user info + photo URL
 * ═══════════════════════════════════════════════════════════
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import {
    getPresignedUploadUrl,
    getPresignedViewUrl,
    deleteFile,
    isAllowedContentType,
    extForContentType,
    profilePhotoKey,
    providerDocKey,
} from '../services/s3.service';

// ─── POST /api/v1/upload/presign ────────────────────────
// Body: { purpose: 'profile' | 'provider_doc', contentType: string, docType?: string, providerId?: string }
// Returns: { uploadUrl, key, expiresIn }

export async function presignUpload(req: Request, res: Response): Promise<void> {
    try {
        const userId: string = (req as any).user.userId;
        const { purpose, contentType, docType, providerId } = req.body;

        if (!purpose || !contentType) {
            res.status(400).json({ success: false, error: 'purpose and contentType are required' });
            return;
        }

        if (!isAllowedContentType(contentType)) {
            res.status(400).json({
                success: false,
                error: `Unsupported content type. Allowed: image/jpeg, image/png, image/webp, application/pdf`,
            });
            return;
        }

        const ext = extForContentType(contentType);
        let key: string;

        if (purpose === 'profile') {
            key = profilePhotoKey(userId, ext);
        } else if (purpose === 'provider_doc') {
            if (!providerId || !docType) {
                res.status(400).json({ success: false, error: 'providerId and docType are required for provider_doc' });
                return;
            }
            key = providerDocKey(providerId as string, docType as string, ext);
        } else {
            res.status(400).json({ success: false, error: 'purpose must be "profile" or "provider_doc"' });
            return;
        }

        const uploadUrl = await getPresignedUploadUrl(key, contentType);

        res.json({
            success: true,
            data: {
                uploadUrl,
                key,
                expiresIn: 900, // 15 minutes
                instructions: 'PUT the file directly to uploadUrl with the matching Content-Type header',
            },
        });
    } catch (error) {
        console.error('Presign error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate upload URL' });
    }
}

// ─── PUT /api/v1/users/me/photo ─────────────────────────
// Body: { key: string }  — S3 key returned by /presign
// Returns: { success, photoUrl }

export async function saveProfilePhoto(req: Request, res: Response): Promise<void> {
    try {
        const userId: string = (req as any).user.userId;
        const { key } = req.body;

        if (!key || typeof key !== 'string') {
            res.status(400).json({ success: false, error: 'key is required' });
            return;
        }

        // Only allow the user to save their own profile key
        if (!key.startsWith(`users/${userId}/`)) {
            res.status(403).json({ success: false, error: 'Key does not belong to this user' });
            return;
        }

        // Delete old photo if it exists and is different
        const existing = await prisma.user.findUnique({
            where: { id: userId },
            select: { profilePhotoKey: true },
        });

        if (existing?.profilePhotoKey && existing.profilePhotoKey !== key) {
            await deleteFile(existing.profilePhotoKey).catch(() => {}); // Best-effort
        }

        await prisma.user.update({
            where: { id: userId },
            data: { profilePhotoKey: key },
        });

        const photoUrl = await getPresignedViewUrl(key);

        res.json({ success: true, data: { photoUrl } });
    } catch (error) {
        console.error('Save photo error:', error);
        res.status(500).json({ success: false, error: 'Failed to save profile photo' });
    }
}

// ─── GET /api/v1/users/me ───────────────────────────────

export async function getMe(req: Request, res: Response): Promise<void> {
    try {
        const userId: string = (req as any).user.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                phone: true,
                name: true,
                email: true,
                profilePhotoKey: true,
                referralCode: true,
                createdAt: true,
            },
        });

        if (!user) {
            res.status(404).json({ success: false, error: 'User not found' });
            return;
        }

        const photoUrl = user.profilePhotoKey
            ? await getPresignedViewUrl(user.profilePhotoKey)
            : null;

        res.json({
            success: true,
            data: {
                ...user,
                profilePhotoKey: undefined, // Don't expose the raw S3 key
                photoUrl,
            },
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ success: false, error: 'Failed to get user' });
    }
}
