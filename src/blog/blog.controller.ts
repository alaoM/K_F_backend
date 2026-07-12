import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { BlogService } from './blog.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from 'src/users/user-role.enum';

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() createBlogPostDto: CreateBlogPostDto, @Req() req) {
    return this.blogService.create(createBlogPostDto, req.user);
  }

  @Get()
  findAll() {
    return this.blogService.findAll();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.blogService.findOneBySlug(slug);
  }

  @Post(':slug/comments')
  addComment(
    @Param('slug') slug: string,
    @Body() commentData: { name: string; email: string; content: string }
  ) {
    return this.blogService.addComment(slug, commentData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.blogService.remove(id);
  }
}
