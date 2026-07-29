import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { IsNull, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { Category } from "./entities/category.entity";

@Injectable()
export class CategoriesService {
  constructor(@InjectRepository(Category) private repo: Repository<Category>) { }

  /**
   * Computes current depth level of a category (1-indexed).
   * Generation 1 = Top Level (parent is null)
   */
  async getCategoryDepth(categoryId: string): Promise<number> {
    let depth = 1;
    let currentId: string | null = categoryId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const cat = await this.repo.findOne({
        where: { id: currentId },
        relations: ['parent'],
      });

      if (cat?.parent?.id) {
        depth++;
        currentId = cat.parent.id;
      } else {
        break;
      }
    }
    return depth;
  }

  /**
   * Computes the maximum depth of a sub-tree rooted at the given category.
   */
  async getSubtreeDepth(category: Category): Promise<number> {
    const catWithChildren = await this.repo.findOne({
      where: { id: category.id },
      relations: [
        'children',
        'children.children',
        'children.children.children',
        'children.children.children.children',
      ],
    });

    if (!catWithChildren) return 1;

    const computeDepth = (node: Category): number => {
      if (!node.children || node.children.length === 0) return 1;
      const childDepths = node.children.map(child => computeDepth(child));
      return 1 + Math.max(...childDepths);
    };

    return computeDepth(catWithChildren);
  }

  async create(dto: CreateCategoryDto) {
    let parentDepth = 0;
    if (dto.parentId) {
      const parentExists = await this.repo.findOne({ where: { id: dto.parentId } });
      if (!parentExists) throw new NotFoundException('Parent category not found');
      parentDepth = await this.getCategoryDepth(dto.parentId);
      if (parentDepth >= 5) {
        throw new BadRequestException('Cannot create sub-category beyond 5 generations.');
      }
    }

    const slug = dto.name
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');

    const category = this.repo.create({
      name: dto.name,
      icon: dto.icon,
      image: dto.image,
      commissionPercent: dto.commissionPercent ?? null,
      slug,
      parent: dto.parentId ? { id: dto.parentId } : null,
    });

    const savedCategory = await this.repo.save(category);

    // If bulk subcategories are provided, create them under savedCategory
    if (dto.subcategories && dto.subcategories.length > 0) {
      const newCategoryDepth = parentDepth + 1;
      if (newCategoryDepth >= 5) {
        throw new BadRequestException('Cannot add sub-categories under a Generation 5 category.');
      }

      const createdSubcategories: Category[] = [];
      for (const subName of dto.subcategories) {
        const trimmed = subName.trim();
        if (!trimmed) continue;

        const subSlug = `${savedCategory.slug}-${trimmed.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-')}`;
        const subCat = this.repo.create({
          name: trimmed,
          slug: subSlug,
          icon: dto.icon || '📁',
          parent: { id: savedCategory.id },
        });
        const savedSub = await this.repo.save(subCat);
        createdSubcategories.push(savedSub);
      }
      return { ...savedCategory, children: createdSubcategories };
    }

    return savedCategory;
  }

  /**
   * Fetches Parent categories and recursively populates children down to 5 generations.
   */
  async findAll() {
    return await this.repo.find({
      where: { parent: IsNull() },
      relations: [
        'children',
        'children.children',
        'children.children.children',
        'children.children.children.children',
      ],
      order: { name: 'ASC' }
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.repo.findOne({ where: { id }, relations: ['parent'] });
    if (!category) throw new NotFoundException('Category not found');

    if (dto.parentId !== undefined && dto.parentId !== category.parent?.id) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }

      if (dto.parentId) {
        const parentExists = await this.repo.findOne({ where: { id: dto.parentId } });
        if (!parentExists) throw new NotFoundException('Target parent category not found');

        const newParentDepth = await this.getCategoryDepth(dto.parentId);
        const subtreeHeight = await this.getSubtreeDepth(category);

        if (newParentDepth + subtreeHeight > 5) {
          throw new BadRequestException(
            `Moving this category would result in ${newParentDepth + subtreeHeight} generations, exceeding the 5 generations limit.`
          );
        }

        category.parent = { id: dto.parentId } as Category;
      } else {
        category.parent = null;
      }
    }

    if (dto.name) {
      category.slug = dto.name.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
    }

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

    if (category.products?.length > 0 || category.children?.length > 0) {
      throw new BadRequestException(
        'Cannot delete category that contains products or sub-categories. Move or remove them first.'
      );
    }

    await this.repo.remove(category);
    return { success: true };
  }
}