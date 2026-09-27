import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { IsNull, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { Category } from "./entities/category.entity";
import { Product } from "src/products/entities/product.entity";

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private repo: Repository<Category>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
  ) { }

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

    const name = dto.name.trim();
    const slug = name
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');

    // Pre-check duplicate name or slug to avoid 500 DB error
    const existing = await this.repo.findOne({
      where: [{ name }, { slug }],
    });
    if (existing) {
      throw new ConflictException(`A category with the name "${name}" or slug "${slug}" already exists.`);
    }

    const category = this.repo.create({
      name,
      icon: dto.icon,
      image: dto.image,
      commissionPercent: dto.commissionPercent ?? null,
      slug,
      parent: dto.parentId ? { id: dto.parentId } : null,
    });

    let savedCategory: Category;
    try {
      savedCategory = await this.repo.save(category);
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY' || err?.message?.includes('Duplicate entry')) {
        throw new ConflictException(`A category with the name "${name}" already exists.`);
      }
      throw err;
    }

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

        const baseSubSlug = `${savedCategory.slug}-${trimmed.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-')}`;
        
        // Check duplicate for bulk item
        const existingSub = await this.repo.findOne({
          where: [{ name: trimmed }, { slug: baseSubSlug }],
        });

        const subSlug = existingSub ? `${baseSubSlug}-${Date.now().toString().slice(-4)}` : baseSubSlug;

        const subCat = this.repo.create({
          name: trimmed,
          slug: subSlug,
          icon: dto.icon || '📁',
          parent: { id: savedCategory.id },
        });

        try {
          const savedSub = await this.repo.save(subCat);
          createdSubcategories.push(savedSub);
        } catch {
          // Skip individual subcategory collision gracefully
        }
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
      const newName = dto.name.trim();
      const newSlug = newName.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');

      const existing = await this.repo.findOne({
        where: [{ name: newName }, { slug: newSlug }],
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(`A category with the name "${newName}" or slug "${newSlug}" already exists.`);
      }

      category.name = newName;
      category.slug = newSlug;
    }

    if (dto.commissionPercent !== undefined) {
      category.commissionPercent = dto.commissionPercent ?? null;
    }

    Object.assign(category, dto);

    try {
      return await this.repo.save(category);
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY' || err?.message?.includes('Duplicate entry')) {
        throw new ConflictException(`Category with this name or slug already exists.`);
      }
      throw err;
    }
  }

  /**
   * Finds or creates the default fallback category ("Uncategorized")
   */
  async getOrCreateDefaultCategory(): Promise<Category> {
    let uncategorized = await this.repo.findOne({
      where: [{ slug: 'uncategorized' }, { name: 'Uncategorized' }],
    });

    if (!uncategorized) {
      const created = this.repo.create({
        name: 'Uncategorized',
        slug: 'uncategorized',
        icon: '📦',
        parent: null,
      });

      try {
        uncategorized = await this.repo.save(created);
      } catch {
        uncategorized = await this.repo.findOne({
          where: [{ slug: 'uncategorized' }, { name: 'Uncategorized' }],
        });
      }
    }

    return uncategorized!;
  }

  /**
   * WooCommerce pattern:
   * - Prevents deleting default "Uncategorized" category.
   * - Reassigns all products to targetCategory (or "Uncategorized").
   * - Promotes sub-categories to the deleted category's parent.
   * - Deletes the category safely without foreign key violations.
   */
  async remove(id: string, transferToCategoryId?: string) {
    const category = await this.repo.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });

    if (!category) throw new NotFoundException('Category not found');

    if (category.slug === 'uncategorized' || category.name.toLowerCase() === 'uncategorized') {
      throw new BadRequestException('The default "Uncategorized" category cannot be deleted.');
    }

    if (transferToCategoryId && transferToCategoryId === id) {
      throw new BadRequestException('Cannot transfer products to the category being deleted.');
    }

    // 1. Determine destination category for products
    let targetCategory: Category;
    if (transferToCategoryId) {
      const found = await this.repo.findOne({ where: { id: transferToCategoryId } });
      if (!found) {
        throw new NotFoundException('Target category for product reassignment not found');
      }
      targetCategory = found;
    } else {
      targetCategory = await this.getOrCreateDefaultCategory();
    }

    // 2. Reassign all products (both active and soft-deleted)
    await this.productRepo
      .createQueryBuilder()
      .update(Product)
      .set({ categoryId: targetCategory.id })
      .where('categoryId = :id', { id })
      .execute();

    // 3. Promote sub-categories to this category's parent (or top-level if parent is null)
    if (category.children && category.children.length > 0) {
      const newParentId = category.parent?.id || null;
      for (const child of category.children) {
        await this.repo.update(child.id, {
          parent: newParentId ? ({ id: newParentId } as Category) : null,
        });
      }
    }

    // 4. Safely remove the category
    await this.repo.delete(id);

    return {
      success: true,
      message: `Category "${category.name}" deleted. Products were reassigned to "${targetCategory.name}".`,
    };
  }
}