import { Injectable } from '@angular/core';
import { CandyAdminCategory, CandyAdminProduct, CandyCategory, CandyProduct } from '../models/candy';
import { supabase } from '../supabase.client';

interface CandyCategoryRow {
  id: number;
  name: string;
  sort_order: number;
  active?: boolean;
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
  active?: boolean;
}

export interface CandyCategoryInput {
  name: string;
  sort_order: number;
  active: boolean;
}

export interface CandyProductInput {
  category_id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_combo: boolean;
  is_featured: boolean;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class CandyService {
  async getAdminCatalog(): Promise<{ categories: CandyAdminCategory[]; products: CandyAdminProduct[] }> {
    const [categoriesResult, productsResult] = await Promise.all([
      supabase
        .from('candy_categories')
        .select('id,name,sort_order,active')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('candy_products')
        .select('id,category_id,name,description,price,image_url,is_combo,is_featured,active')
        .order('category_id', { ascending: true })
        .order('name', { ascending: true }),
    ]);

    if (categoriesResult.error) throw new Error(categoriesResult.error.message);
    if (productsResult.error) throw new Error(productsResult.error.message);

    return {
      categories: ((categoriesResult.data ?? []) as CandyCategoryRow[]).map(category => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sort_order,
        active: category.active ?? true,
      })),
      products: ((productsResult.data ?? []) as CandyProductRow[]).map(product => this.mapAdminProduct(product)),
    };
  }

  async saveCategory(input: CandyCategoryInput, id?: number): Promise<CandyAdminCategory> {
    const query = id === undefined
      ? supabase.from('candy_categories').insert(input)
      : supabase.from('candy_categories').update(input).eq('id', id);
    const { data, error } = await query.select('id,name,sort_order,active').single();
    if (error) throw new Error(error.message);
    const row = data as CandyCategoryRow;
    return { id: row.id, name: row.name, sortOrder: row.sort_order, active: row.active ?? true };
  }

  async setCategoryActive(id: number, active: boolean): Promise<CandyAdminCategory> {
    const { data, error } = await supabase
      .from('candy_categories')
      .update({ active })
      .eq('id', id)
      .select('id,name,sort_order,active')
      .single();
    if (error) throw new Error(error.message);
    const row = data as CandyCategoryRow;
    return { id: row.id, name: row.name, sortOrder: row.sort_order, active: row.active ?? true };
  }

  async saveProduct(input: CandyProductInput, id?: number, imageFile?: File, imageUrl?: string): Promise<CandyAdminProduct> {
    let imagePath = imageUrl?.trim() || input.image_url.trim();
    let uploadedImagePath: string | null = null;

    if (imageFile) {
      uploadedImagePath = await this.uploadImage(imageFile);
      imagePath = uploadedImagePath;
    }

    const query = id === undefined
      ? supabase.from('candy_products').insert({ ...input, image_url: imagePath })
      : supabase.from('candy_products').update({ ...input, image_url: imagePath }).eq('id', id);
    const { data, error } = await query
      .select('id,category_id,name,description,price,image_url,is_combo,is_featured,active')
      .single();

    if (error) {
      if (uploadedImagePath) await this.removeImage(uploadedImagePath);
      throw new Error(error.message);
    }
    if (input.image_url && input.image_url !== imagePath) await this.removeImage(input.image_url);
    return this.mapAdminProduct(data as CandyProductRow);
  }

  async setProductActive(id: number, active: boolean): Promise<CandyAdminProduct> {
    const { data, error } = await supabase
      .from('candy_products')
      .update({ active })
      .eq('id', id)
      .select('id,category_id,name,description,price,image_url,is_combo,is_featured,active')
      .single();
    if (error) throw new Error(error.message);
    return this.mapAdminProduct(data as CandyProductRow);
  }

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

  private mapAdminProduct(row: CandyProductRow): CandyAdminProduct {
    const imagePath = row.image_url.trim();
    const imageUrl = imagePath && !/^https?:\/\//i.test(imagePath)
      ? supabase.storage.from('candy').getPublicUrl(imagePath).data.publicUrl
      : imagePath;
    return {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      imageUrl,
      imagePath,
      isCombo: row.is_combo,
      isFeatured: row.is_featured,
      active: row.active ?? true,
    };
  }

  private async uploadImage(file: File): Promise<string> {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensions[file.type];
    if (!extension) throw new Error('La imagen debe ser JPG, PNG o WebP.');
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('candy').upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return path;
  }

  private async removeImage(path: string): Promise<void> {
    const marker = '/storage/v1/object/public/candy/';
    const storagePath = path.startsWith(marker) ? path.slice(marker.length) : path;
    if (/^https?:\/\//i.test(storagePath)) return;
    const { error } = await supabase.storage.from('candy').remove([storagePath]);
    if (error) console.error('No se pudo quitar la imagen de Candy:', error.message);
  }
}
