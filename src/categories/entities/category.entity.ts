// src/categories/entities/category.entity.ts
import { Product } from 'src/products/entities/product.entity';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne } from 'typeorm';
 

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;  

  @Column({ nullable: true })
  icon: string; // URL to an icon or an icon name

  @Column({ nullable: true })
  image: string; // URL to a background image

  // Self-referencing relationship for Sub-categories
  @ManyToOne(() => Category, (category) => category.children, { nullable: true, onDelete: 'SET NULL' })
  parent: Category;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  // Products in this category
  @OneToMany(() => Product, (product) => product.category)
  products: Product[];


  /**
   * Platform commission for this category.
   * null = inherit from global SystemSettings
   */
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  commissionPercent: number | null;

  /**
   * Optional: different commission for sub-categories
   * If a child has its own rate, that takes priority over parent's rate
   */
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  parentInheritedCommission: number | null;
}