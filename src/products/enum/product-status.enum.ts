export enum ProductStatus {
  DRAFT = 'draft',           // Visible only to the seller
  PUBLISHED = 'published',   // Live on the marketplace
  OUT_OF_STOCK = 'out_of_stock', // Visible but cannot be bought
  ARCHIVED = 'archived',     // Hidden from everyone, kept for order history
  SUSPENDED = 'suspended',   // Hidden by Admin (e.g., for policy violations)
}