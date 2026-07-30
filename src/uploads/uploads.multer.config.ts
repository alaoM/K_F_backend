import { diskStorage } from 'multer';
import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs'; // <-- Added to handle folder creation

const UPLOAD_PATH = process.env.UPLOAD_DESTINATION || './uploads';

// Safely create the folder if it doesn't exist (prevents crashes on new environments)
if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
}

export const imageUploadConfig = {
  storage: diskStorage({
    destination: UPLOAD_PATH,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    // SECURITY CHECK: Match the actual mimetype, not just the file name extension
    if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
      return cb(
        new BadRequestException('Only image files (JPG, PNG, GIF, WEBP) are allowed'),
        false,
      );
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
};