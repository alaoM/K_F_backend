import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogPost } from './entities/blog-post.entity';
import { BlogComment } from './entities/comment.entity';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(BlogPost)
    private readonly blogRepository: Repository<BlogPost>,
    @InjectRepository(BlogComment)
    private readonly commentRepository: Repository<BlogComment>,
  ) {}

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')     // Replace spaces with -
      .replace(/[^\w-]+/g, '')  // Remove all non-word chars
      .replace(/--+/g, '-');    // Replace multiple - with single -
  }

  async create(createBlogPostDto: CreateBlogPostDto, author: User): Promise<BlogPost> {
    const slug = this.slugify(createBlogPostDto.title);
    
    // Check if slug exists and append random string if it does
    let finalSlug = slug;
    let slugExists = await this.blogRepository.findOne({ where: { slug: finalSlug } });
    if (slugExists) {
      finalSlug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
    }

    const authorId = author.id || (author as any).sub;

    const post = this.blogRepository.create({
      ...createBlogPostDto,
      slug: finalSlug,
      authorId,
    });

    return this.blogRepository.save(post);
  }

  async findAll() {
    return this.blogRepository.find({
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOneBySlug(slug: string) {
    const post = await this.blogRepository.findOne({
      where: { slug },
      relations: ['author', 'comments'],
    });

    if (!post) {
      throw new NotFoundException(`Blog post with slug ${slug} not found`);
    }

    // Increment views
    post.views += 1;
    await this.blogRepository.save(post);

    return post;
  }

  async addComment(slug: string, commentData: { name: string; email: string; content: string }) {
    const post = await this.findOneBySlug(slug);
    const comment = this.commentRepository.create({
      ...commentData,
      blogPostId: post.id,
    });
    return this.commentRepository.save(comment);
  }

  async remove(id: string) {
    const result = await this.blogRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Blog post with ID ${id} not found`);
    }
    return { message: 'Blog post deleted successfully' };
  }
}
