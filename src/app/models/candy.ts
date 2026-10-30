export interface CandyCategory {
  id: number;
  name: string;
  sortOrder: number;
  products: CandyProduct[];
}

export interface CandyProduct {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isCombo: boolean;
  isFeatured: boolean;
}
