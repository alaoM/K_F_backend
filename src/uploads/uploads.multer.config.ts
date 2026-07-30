import { diskStorage } from 'multer';
import { extname, resolve } from 'path';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

export const imageUploadConfig = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = process.env.UPLOAD_DESTINATION 
        ? resolve(process.env.UPLOAD_DESTINATION)
        : resolve('./uploads');

      // Safely ensure upload directory exists at request time
      if (!fs.existsSync(uploadPath)) {
        try {
          fs.mkdirSync(uploadPath, { recursive: true });
        } catch (err: any) {
          return cb(new BadRequestException(`Failed to create upload directory: ${err.message}`), '');
        }
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname).toLowerCase();
      cb(null, `${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    // SECURITY CHECK: Match image mimetype (case-insensitive)
    if (!file.mimetype.match(/^image\/(jpg|jpeg|png|gif|webp)$/i)) {
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