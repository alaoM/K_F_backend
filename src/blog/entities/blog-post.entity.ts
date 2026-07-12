import { User } from "src/users/entities/user.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { BlogComment } from "./comment.entity";

@Entity('blog_posts')
export class BlogPost {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column({ unique: true })
    slug: string;

    @Column({ type: 'text' })
    content: string;

    @Column({ nullable: true })
    featuredImage: string;

    @Column({ type: 'json', nullable: true })
    tags: string[];

    @Column({ default: 0 })
    views: number;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'authorId' })
    author: User;

    @Column()
    authorId: string;

    @OneToMany(() => BlogComment, (comment) => comment.blogPost)
    comments: BlogComment[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
