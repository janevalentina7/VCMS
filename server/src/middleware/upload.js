/**
 * Secure image upload pipeline.
 *
 * Defence in depth:
 *  1. multer restricts size (MAX_UPLOAD_MB) and rejects anything over the limit early.
 *  2. Extension allow-list check on the original filename.
 *  3. MIME + magic-byte sniffing via `sharp` - the file must actually decode
 *     as JPEG/PNG/WEBP, so renaming `payload.php` to `.jpg` fails.
 *  4. Re-encoding with `sharp` strips EXIF/metadata and produces a safe,
 *     compressed derivative (also satisfies the "image compression" requirement).
 *  5. Filenames are generated (random hex) - user input never reaches the disk
 *     path, which prevents traversal and keeps stored files predictable.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import config, { UPLOAD_ROOT } from '../config/env.js';
import { badRequest, payloadTooLarge } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export const subdir = (name) => ensureDir(path.join(UPLOAD_ROOT, name));

const tempStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ensureDir(path.join(UPLOAD_ROOT, 'tmp'))),
  filename: (_req, _file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.part`),
});

export const imageUpload = (field = 'image', { maxCount = 1 } = {}) =>
  multer({
    storage: tempStorage,
    limits: { fileSize: config.uploads.maxBytes, files: maxCount },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!config.uploads.allowedExt.includes(ext)) {
        return cb(
          badRequest(
            `Unsupported file type "${ext || 'unknown'}". Please upload a JPG, JPEG, PNG or WEBP image.`,
            { field, reupload: true },
          ),
        );
      }
      if (!config.uploads.allowedMime.includes(String(file.mimetype).toLowerCase())) {
        return cb(
          badRequest('The selected file is not a supported image. Please upload a JPG, JPEG, PNG or WEBP image.', {
            field,
            reupload: true,
          }),
        );
      }
      return cb(null, true);
    },
  }).array(field, maxCount);

/**
 * Validates + normalises every uploaded file, replacing req.files with
 * metadata records. Never throws for "no file supplied" - images are optional.
 */
export const processImageUpload = (targetSubdir = 'complaints', { maxWidth = 1600, quality = 82 } = {}) => async (req, _res, next) => {
  const files = req.files || [];
  if (!files.length) {
    req.uploadedImage = null;
    return next();
  }

  const destDir = ensureDir(path.join(UPLOAD_ROOT, targetSubdir));
  const processed = [];

  try {
    for (const file of files) {
      if (file.size > config.uploads.maxBytes) {
        throw payloadTooLarge(`File size exceeds the allowed limit of ${config.uploads.maxMb} MB.`);
      }

      // Magic-byte / real decodability check.
      const meta = await sharp(file.path).metadata().catch(() => null);
      const format = meta?.format;
      if (!meta || !['jpeg', 'jpg', 'png', 'webp'].includes(format)) {
        throw badRequest('The uploaded file could not be read as a JPG, PNG or WEBP image.', { reupload: true });
      }

      const safeName = `vcms-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.webp`;
      const outPath = path.join(destDir, safeName);

      await sharp(file.path)
        .rotate() // honour EXIF orientation before metadata is stripped
        .resize({ width: maxWidth, withoutEnlargement: true, fit: 'inside' })
        .webp({ quality })
        .toFile(outPath);

      await fsp.unlink(file.path).catch(() => {});

      const stat = await fsp.stat(outPath);
      processed.push({
        url: `${config.uploads.publicPath}/${targetSubdir}/${safeName}`,
        filename: safeName,
        mimeType: 'image/webp',
        originalName: path.basename(file.originalname || 'image'),
        sizeBytes: stat.size,
        width: meta.width ?? null,
        height: meta.height ?? null,
      });
      logger.debug(`stored upload ${safeName} (${Math.round(stat.size / 1024)} KB)`);
    }

    req.uploadedImages = processed;
    req.uploadedImage = processed[0] ?? null;
    return next();
  } catch (error) {
    await Promise.all(files.map((f) => fsp.unlink(f.path).catch(() => {})));
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(payloadTooLarge(`File size exceeds the allowed limit of ${config.uploads.maxMb} MB.`));
      }
      return next(badRequest(`Image upload failed: ${error.message}`));
    }
    return next(error);
  }
};

/** Removes a previously stored upload (best effort, used on avatar replace). */
export const removeUpload = async (publicUrl) => {
  if (!publicUrl || !publicUrl.startsWith(config.uploads.publicPath)) return;
  const relative = publicUrl.slice(config.uploads.publicPath.length).replace(/^\/+/, '');
  const absolute = path.join(UPLOAD_ROOT, relative);
  if (!absolute.startsWith(UPLOAD_ROOT)) return; // path traversal guard
  await fsp.unlink(absolute).catch(() => {});
};

export default { imageUpload, processImageUpload, removeUpload, subdir };
