import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
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

    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,

    @InjectRepository(SellerProfile)
    private readonly sellerRepo: Repository<SellerProfile>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    private readonly trackingService: TrackingService,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
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

  async findOnePublic(id: string, context?: { clientIp?: string; userId?: string | null }) {
    const product = await this.productRepo.findOne({
      where: { id, status: ProductStatus.PUBLISHED },
      relations: ['seller', 'variants', 'category'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // 🛡️ De-duplicate views (1 view per user / IP per 2 hours)
    const identifier = context?.userId || context?.clientIp || 'unknown-client';
    const viewCacheKey = `product_view:${product.id}:${identifier}`;

    try {
      const alreadyViewed = await this.cacheManager.get(viewCacheKey);

      if (!alreadyViewed) {
        // Cache for 2 hours (7,200,000 ms)
        await this.cacheManager.set(viewCacheKey, true, 2 * 60 * 60 * 1000);
        await this.productRepo.increment({ id: product.id }, 'views', 1);
        this.trackingService.track(context?.userId || null, product.id, ActivityType.VIEW);
        product.views = (product.views || 0) + 1;
      }
    } catch (e) {
      // Fallback gracefully if cache has transient issues
    }

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
      .leftJoinAndSelect('product.variants', 'variants') // Join variants for sizes/colors/stock
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
      product = await this.productRepo.findOne({ where: { id: productId }, relations: ['variants', 'category'] });
    } else {
      const seller = await this.getSellerByUser(userId);
      product = await this.productRepo.findOne({
        where: { id: productId, seller: { id: seller.id } },
        relations: ['variants', 'category'],
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

    const { variants, ...productData } = dto;

    const product = this.productRepo.create({
      ...productData,
      seller,
      status: ProductStatus.DRAFT,
      category,
      hasVariants: Boolean(dto.hasVariants && variants && variants.length > 0),
    });

    if (dto.hasVariants && variants && variants.length > 0) {
      product.stock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      product.variants = variants.map((v) =>
        this.variantRepo.create({
          sku: v.sku,
          color: v.color,
          colorHex: v.colorHex,
          size: v.size,
          stock: Number(v.stock) || 0,
          price: v.price !== undefined && v.price !== null ? Number(v.price) : undefined,
          image: v.image,
          attributes: v.attributes,
        }),
      );
    }

    return this.productRepo.save(product);
  }

  async update(userId: string, productId: string, dto: UpdateProductDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('User not found');

    const isAdmin = user.role === UserRole.ADMIN;
    let product;

    if (isAdmin) {
      product = await this.productRepo.findOne({ where: { id: productId }, relations: ['variants'] });
    } else {
      const seller = await this.getSellerByUser(userId);
      product = await this.productRepo.findOne({
        where: { id: productId, seller: { id: seller.id } },
        relations: ['variants'],
      });
    }

    if (!product) {
      throw new ForbiddenException(isAdmin ? 'Product not found' : 'You do not own this product');
    }

    // 1. Handle Category Relation explicitly to avoid TypeORM 'null' errors
    const { categoryId, category, variants, ...otherFields } = dto;
    const targetCategoryId = categoryId || category;

    if (targetCategoryId) {
      product.category = { id: targetCategoryId } as any;
    }

    // 4. Apply all other fields (including status if present)
    Object.assign(product, otherFields);

    if (dto.status) {
      product.status = dto.status;
    }

    // 5. Handle variants synchronization
    if (dto.hasVariants !== undefined) {
      product.hasVariants = Boolean(dto.hasVariants);
    }

    if (dto.hasVariants && Array.isArray(variants)) {
      await this.variantRepo.delete({ productId: product.id });
      product.stock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      product.variants = variants.map((v) =>
        this.variantRepo.create({
          productId: product.id,
          sku: v.sku,
          color: v.color,
          colorHex: v.colorHex,
          size: v.size,
          stock: Number(v.stock) || 0,
          price: v.price !== undefined && v.price !== null ? Number(v.price) : undefined,
          image: v.image,
          attributes: v.attributes,
        }),
      );
    } else if (dto.hasVariants === false) {
      await this.variantRepo.delete({ productId: product.id });
      product.variants = [];
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
    const newSeller = this.sellerRepo.create({
      user: { id: userId },
      businessName: `${user.fullName}'s Store`,
    });

    return await this.sellerRepo.save(newSeller);
  }
}