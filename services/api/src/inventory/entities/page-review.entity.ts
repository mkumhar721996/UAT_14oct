import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('page_reviews')
export class PageReview {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'page_id', type: 'text', unique: true })
  pageId!: string;

  @Column({ name: 'reviewer_name', type: 'text' })
  reviewerName!: string;

  @Column({ name: 'review_date', type: 'date' })
  reviewDate!: string;

  @Column({ type: 'text' })
  result!: 'pass' | 'fail';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
