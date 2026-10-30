import { Injectable } from '@angular/core';
import { CandyCategory, CandyProduct } from '../models/candy';
import { supabase } from '../supabase.client';

interface CandyCategoryRow {
  id: number;
  name: string;
  sort_order: number;
}

interface CandyProductRow {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price: number | string;
  image_url: string;
  is_combo: boolean;
  is_featured: boolean;
}

@Injectable({ providedIn: 'root' })
export class CandyService {
  async getCatalog(): Promise<CandyCategory[]> {
    const [categoriesResult, productsResult] = await Promise.all([
      supabase
        .from('candy_categories')
        .select('id,name,sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('candy_products')
        .select('id,category_id,name,description,price,image_url,is_combo,is_featured')
        .eq('active', true)
        .order('is_featured', { ascending: false })
        .order('is_combo', { ascending: false })
        .order('name', { ascending: true }),
    ]);

    if (categoriesResult.error) throw new Error(categoriesResult.error.message);
    if (productsResult.error) throw new Error(productsResult.error.message);

    const categories = (categoriesResult.data ?? []) as CandyCategoryRow[];
    const products = (productsResult.data ?? []) as CandyProductRow[];
    const activeCategoryIds = new Set(categories.map(category => category.id));

    return categories
      .map(category => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sort_order,
        products: products
          .filter(product => product.category_id === category.id && activeCategoryIds.has(product.category_id))
          .map(product => this.mapProduct(product)),
      }))
      .filter(category => category.products.length > 0);
  }

  private mapProduct(row: CandyProductRow): CandyProduct {
    const imageUrl = row.image_url.trim();
    const publicImageUrl = imageUrl && !/^https?:\/\//i.test(imageUrl)
      ? supabase.storage.from('candy').getPublicUrl(imageUrl).data.publicUrl
      : imageUrl;

    return {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      imageUrl: publicImageUrl,
      isCombo: row.is_combo,
      isFeatured: row.is_featured,
    };
  }
}
