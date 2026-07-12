import { User } from "src/users/entities/user.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { ProductStatus } from "../enum/product-status.enum";
import { Category } from "src/categories/entities/category.entity";
import { SellerProfile } from "src/seller/entities/seller-profile.entity";
import { Review } from "src/reviews/entities/review.entity";


export class ColumnNumericTransformer {
    to(data: number): number { return data; }
    from(data: string): number { return parseFloat(data); }
}

export enum ProductType {
    PHYSICAL = 'physical',
    DIGITAL = 'digital',
    SERVICE = 'service'
}

@Entity('products')
export class Product {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'decimal', precision: 12, scale: 2, transformer: new ColumnNumericTransformer() })
    price: number;

    @Column({ type: 'int', default: 0 })
    stock: number;

    @ManyToOne(() => Category, (category) => category.products, { nullable: false })
    // @JoinColumn({ name: 'categoryId' })
    category: Category;

    @Column()
    categoryId: string;

    @Column({ type: 'varchar', nullable: true })
    primaryImage: string;

    @Column({ type: 'json', nullable: true }) // Using JSON to store an array of strings
    otherImages: string[];

    // Trust Signals
    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    averageRating: number;

    @Column({ default: 0 })
    reviewCount: number;

    @Column({ default: false })
    isOrganic: boolean;

    @Column({ default: false })
    isVerifiedVendor: boolean;

    @Column({ default: 0 })
    views: number;
 

    // Flexible Attributes (Weight: 2kg, Origin: Kenya, etc.)
    @Column({ type: 'json', nullable: true })
    attributes: Record<string, any>;

    @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.PUBLISHED })
    status: ProductStatus;


    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => SellerProfile, (profile) => profile.products, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sellerProfileId' })
    seller: SellerProfile;

    @Column()
    sellerProfileId: string;

    @Column({ type: 'enum', enum: ProductType, default: ProductType.PHYSICAL })
    type: ProductType;

    @Column({ type: 'text', nullable: true })
    digitalContentUrl: string

    /* ----------------REVIEWS  RELATIONS ---------------- */
    @OneToMany(() => Review, (review) => review.product)
    reviews: Review[];

    @DeleteDateColumn()
    deletedAt: Date;


}


