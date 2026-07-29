import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { imageUploadConfig } from './uploads.multer.config';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  private getFileUrl(filename: string): string {
    const assetsUrl = process.env.ASSETS_URL;
    if (assetsUrl) {
      const cleanBase = assetsUrl.replace(/\/$/, '');
      if (cleanBase.endsWith('/uploads')) {
        return `${cleanBase}/${filename}`;
      }
      return `${cleanBase}/uploads/${filename}`;
    }
    const appUrl = (process.env.APP_URL || 'http://localhost:4002').replace(/\/$/, '');
    return `${appUrl}/uploads/${filename}`;
  }

  @Post('image')
  @UseInterceptors(FileInterceptor('image', imageUploadConfig))
  uploadSingle(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File upload failed');
    }

    return {
      url: this.getFileUrl(file.filename),
      size: file.size,
    };
  }

  @Post('bulk')
  @UseInterceptors(
    FilesInterceptor('files', 10, imageUploadConfig),
  )
  uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new BadRequestException('No files uploaded');
    }

    return files.map(file => ({
      url: this.getFileUrl(file.filename),
      size: file.size,
    }));
  }
}