import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { BlogPost } from "./blog-post.entity";

@Entity('blog_comments')
export class BlogComment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    email: string;

    @Column({ type: 'text' })
    content: string;

    @ManyToOne(() => BlogPost, (post) => post.comments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'blogPostId' })
    blogPost: BlogPost;

    @Column()
    blogPostId: string;

    @CreateDateColumn()
    createdAt: Date;
}
