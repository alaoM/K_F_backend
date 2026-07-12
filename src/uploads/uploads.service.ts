import { Injectable, BadRequestException } from '@nestjs/common';
import { extname } from 'path';

@Injectable()
export class UploadsService {
  customFileName(req: any, file: any, callback: any) {
    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname).toLowerCase();
    callback(null, `${uniqueSuffix}${ext}`);
  }

  imageFileFilter(req: any, file: any, callback: any) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return callback(
        new BadRequestException('Only image files are allowed'),
        false,
      );
    }
    callback(null, true);
  }
}