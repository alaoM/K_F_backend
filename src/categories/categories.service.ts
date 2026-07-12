import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { IsNull, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { Category } from "./entities/category.entity";

@Injectable()
export class CategoriesService {
  constructor(@InjectRepository(Category) private repo: Repository<Category>) { }

  async create(dto: CreateCategoryDto) {
    const slug = dto.name
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');

    const category = this.repo.create({
      name: dto.name,
      icon: dto.icon,
      image: dto.image,
      slug,
      // Check for truthy parentId to avoid "null" UUID errors in TypeORM
      parent: dto.parentId ? { id: dto.parentId } : null
    });

    return await this.repo.save(category);
  }

  /**
   * Fetches only Parent categories and nests their children.
   * This is what you send to the frontend for the Sidebar/Dropdown.
   */
  async findAll() {
    return await this.repo.find({
      where: { parent: IsNull() }, // Only get top-level
      relations: ['children'],
      order: { name: 'ASC' }
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.repo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    // If name is changed, update the slug
    if (dto.name) {
      category.slug = dto.name.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
    }

    // Explicitly allow setting back to null to restore global rate
    if (dto.commissionPercent !== undefined) {
      category.commissionPercent = dto.commissionPercent ?? null;
    }

    Object.assign(category, dto);
    return await this.repo.save(category);
  }

  async remove(id: string) {
    const category = await this.repo.findOne({
      where: { id },
      relations: ['products', 'children']
    });

    if (!category) throw new NotFoundException('Category not found');

    // Logic: Prevent deletion if category has products or sub-categories
    if (category.products.length > 0 || category.children.length > 0) {
      throw new BadRequestException(
        'Cannot delete category that contains products or sub-categories. Move them first.'
      );
    }

    await this.repo.remove(category);
    return { success: true };
  }
}