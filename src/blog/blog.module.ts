import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { BlogPost } from './entities/blog-post.entity';
import { BlogComment } from './entities/comment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BlogPost, BlogComment])],
  controllers: [BlogController],
  providers: [BlogService],
})
export class BlogModule {}
