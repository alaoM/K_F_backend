// src/products/products.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { SellerProfile } from 'src/seller/entities/seller-profile.entity';
import { ProductStatus } from './enum/product-status.enum';
import { Category } from 'src/categories/entities/category.entity';
import { User } from 'src/users/entities/user.entity';
import { UserRole } from 'src/users/user-role.enum';
import { TrackingService } from 'src/tracking/tracking.service';
import { ActivityType } from 'src/tracking/entities/user-activity.entity';
import { SellerService } from 'src/seller/seller.service';


@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(SellerProfile)
    private readonly sellerRepo: Repository<SellerProfile>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    private readonly trackingService: TrackingService,

  ) { }

  /* ================= PUBLIC ================= */

  async findAllPublic(filters: ProductFilterDto) {
    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.seller', 'seller')
      .where('product.status = :status', {
        status: ProductStatus.PUBLISHED,
      })
      .orderBy('product.createdAt', 'DESC');

    if (filters.sellerSlug) {
      qb.andWhere('seller.storeSlug = :sellerSlug', { sellerSlug: filters.sellerSlug });
    }

    if (filters.category) {
      qb.leftJoin('product.category', 'catRelation');
      qb.andWhere('(product.categoryId = :category OR LOWER(catRelation.name) = LOWER(:category))', {
        category: filters.category,
      });
    }

    if (filters.search) {
      qb.andWhere('(LOWER(product.title) LIKE LOWER(:search) OR LOWER(product.description) LIKE LOWER(:search))', {
        search: `%${filters.search}%`,
      });
    }

    qb.take(filters.limit ?? 20).skip(filters.offset ?? 0);

    return qb.getMany();
  }

  async findOnePublic(id: string) {
    const product = await this.productRepo.findOne({
      where: { id, status: ProductStatus.PUBLISHED },
      relations: ['seller'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Increment views (fire and forget)
    this.productRepo.increment({ id: product.id }, 'views', 1);
    this.trackingService.track(null, product.id, ActivityType.VIEW);

    return product;
  }




  /* ================= SELLER ================= */

  /* async findAllBySeller(userId: string, filters: ProductFilterDto) {
    const seller = await this.getSellerByUser(userId);
    const qb = this.productRepo
    .createQueryBuilder('product')
    .innerJoin('product.seller', 'seller')
    .where('seller.id = :sellerId', { sellerId: seller.id })
    .orderBy('product.createdAt', 'DESC')
    qb.take(filters.limit ?? 20).skip(filters.offset ?? 0);
    return qb.getMany();
  } */

  async findAllBySeller(userId: string, filters: ProductFilterDto) {
    const seller = await this.getSellerByUser(userId);

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category') // Join category for names
      .innerJoin('product.seller', 'seller')
      .where('seller.id = :sellerId', { sellerId: seller.id })

    // --- FILTERS ---
    if (filters.search) {
      qb.andWhere('LOWER(product.title) LIKE LOWER(:search)', {
        search: `%${filters.search}%`
      });
    }

    if (filters.category) {
      qb.andWhere('category.name = :catName', { catName: filters.category });
    }

    // --- SORTING ---
    switch (filters.sortBy) {
      case 'price_asc': qb.orderBy('product.price', 'ASC'); break;
      case 'price_desc': qb.orderBy('product.price', 'DESC'); break;
      case 'rating': qb.orderBy('product.averageRating', 'DESC'); break;
      default: qb.orderBy('product.createdAt', 'DESC');
    }

    // --- PAGINATION ---
    const limit = filters.limit ?? 10;
    const offset = filters.offset ?? 0;
    qb.take(limit).skip(offset);

    const [data, total] = await qb.getManyAndCount();



    return {
      data,
      total,
      limit,
      offset
    };
  }

  async findOneBySeller(userId: string, productId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');

    const isAdmin = user.role === UserRole.ADMIN;
    let product;

    if (isAdmin) {
      product = await this.productRepo.findOne({ where: { id: productId } });
    } else {
      const seller = await this.getSellerByUser(userId);
      product = await this.productRepo.findOne({
        where: { id: productId, seller: { id: seller.id } },
      });
    }

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async create(userId: string, dto: CreateProductDto) {
    const seller = await this.getSellerByUser(userId);

    if (!seller.isActive || seller.vacationMode) {
      throw new ForbiddenException('Store is inactive or on vacation');
    }

    const category = await this.categoryRepo.findOne({
      where: { id: dto.category },
    });

    if (!category) {
      throw new BadRequestException('Invalid category');
    }


    const product = this.productRepo.create({
      ...dto,
      seller,
      status: ProductStatus.DRAFT,
      category
    });

    return this.productRepo.save(product);
  }

  async update(userId: string, productId: string, dto: UpdateProductDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');

    const isAdmin = user.role === UserRole.ADMIN;
    let product;

    if (isAdmin) {
      product = await this.productRepo.findOne({ where: { id: productId } });
    } else {
      const seller = await this.getSellerByUser(userId);
      product = await this.productRepo.findOne({
        where: { id: productId, seller: { id: seller.id } },
      });
    }

    if (!product) {
      throw new ForbiddenException(isAdmin ? 'Product not found' : 'You do not own this product');
    }

    // 1. Identify if the user is trying to change content (title, price, etc.)
    // We filter out 'status' to see if any other keys exist in the DTO
    const updateKeys = Object.keys(dto);
    const isEditingContent = updateKeys.some(key => key !== 'status');

    // 2. Block content edits IF the current status is published
    if (isEditingContent && product.status === ProductStatus.PUBLISHED) {
      throw new ForbiddenException(
        'Please unpublish (draft) the product before editing its details.',
      );
    }

    // 3. Handle Category Relation explicitly to avoid TypeORM 'null' errors
    // DTO has both 'category' and 'categoryId', we'll handle both
    const { categoryId, category, ...otherFields } = dto;
    const targetCategoryId = categoryId || category;

    if (targetCategoryId) {
      // This ensures the foreign key is set correctly without wiping the relation
      product.category = { id: targetCategoryId } as any;
    }

    // 4. Apply all other fields (including status if present)
    Object.assign(product, otherFields);

    if (dto.status) {
      product.status = dto.status;
    }

    return this.productRepo.save(product);
  }

  async delete(userId: string, productId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');

    const isAdmin = user.role === UserRole.ADMIN;
    let product;

    if (isAdmin) {
      product = await this.productRepo.findOne({ where: { id: productId } });
    } else {
      const seller = await this.getSellerByUser(userId);
      product = await this.productRepo.findOne({
        where: { id: productId, seller: { id: seller.id } },
      });
    }

    if (!product) {
      throw new ForbiddenException(isAdmin ? 'Product not found' : 'You do not own this product');
    }



    await this.productRepo.softRemove(product);
    return { message: 'Product deleted successfully' };
  }

  async bulkCreate(userId: string, dtos: CreateProductDto[]) {
    const results = [];
    const errors = [];

    for (const dto of dtos) {
      try {
        const product = await this.create(userId, dto);
        results.push(product);
      } catch (err) {
        errors.push({ title: dto.title, error: err.message });
      }
    }

    return { successCount: results.length, errorCount: errors.length, errors };
  }

  /* ================= HELPERS ================= */

  private async getSellerByUser(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // 1. Try to find existing seller FIRST
    let seller = await this.sellerRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'], // optional but useful
    });

    // 2. If exists → return immediately
    if (seller) return seller;

    // 3. If NOT seller and NOT admin → reject
    if (user.role !== 'admin') {
      throw new ForbiddenException('Seller profile not found');
    }

    // 4. Admin fallback → create seller profile ONCE
    console.log(user, 'is admin but has no seller profile, creating one...');
    const newSeller = this.sellerRepo.create({
      user: { id: userId },
      businessName: `${user.fullName}'s Store`,
    });

    return await this.sellerRepo.save(newSeller);
  }
}