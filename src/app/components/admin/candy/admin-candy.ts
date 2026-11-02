import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CandyAdminCategory, CandyAdminProduct } from '../../../models/candy';
import { CandyCategoryInput, CandyProductInput, CandyService } from '../../../services/candy';

function emptyCategory(): CandyCategoryInput {
  return { name: '', sort_order: 0, active: true };
}

function emptyProduct(): CandyProductInput {
  return {
    category_id: 0,
    name: '',
    description: '',
    price: 0,
    image_url: '',
    is_combo: false,
    is_featured: false,
    active: true,
  };
}

@Component({
  selector: 'app-admin-candy',
  imports: [FormsModule],
  templateUrl: './admin-candy.html',
  styleUrl: './admin-candy.css',
})
export class AdminCandy {
  private candyService = inject(CandyService);

  categories = signal<CandyAdminCategory[]>([]);
  products = signal<CandyAdminProduct[]>([]);
  loading = signal(true);
  savingCategory = signal(false);
  savingProduct = signal(false);
  updatingCategoryId = signal<number | null>(null);
  updatingProductId = signal<number | null>(null);
  errorMessage = signal('');
  successMessage = signal('');

  categoryForm = emptyCategory();
  editingCategoryId: number | null = null;
  productForm = emptyProduct();
  editingProductId: number | null = null;
  imageFile: File | null = null;
  imageUrlInput = '';
  imagePreview = '';
  private savedImagePreview = '';
  private previewObjectUrl: string | null = null;

  constructor() {
    void this.loadCatalog();
  }

  async loadCatalog(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const catalog = await this.candyService.getAdminCatalog();
      this.categories.set(catalog.categories);
      this.products.set(catalog.products);
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo cargar el catálogo de Candy.'));
    } finally {
      this.loading.set(false);
    }
  }

  async saveCategory(): Promise<void> {
    if (this.savingCategory()) return;
    this.errorMessage.set('');
    this.successMessage.set('');
    this.savingCategory.set(true);
    try {
      const saved = await this.candyService.saveCategory({
        ...this.categoryForm,
        name: this.categoryForm.name.trim(),
      }, this.editingCategoryId ?? undefined);
      this.categories.update(items => {
        const updated = this.editingCategoryId === null
          ? [...items, saved]
          : items.map(item => item.id === saved.id ? saved : item);
        return updated.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'));
      });
      this.resetCategoryForm();
      this.successMessage.set('Categoría guardada.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo guardar la categoría.'));
    } finally {
      this.savingCategory.set(false);
    }
  }

  editCategory(category: CandyAdminCategory): void {
    this.editingCategoryId = category.id;
    this.categoryForm = { name: category.name, sort_order: category.sortOrder, active: category.active };
    this.errorMessage.set('');
  }

  resetCategoryForm(): void {
    this.editingCategoryId = null;
    this.categoryForm = emptyCategory();
  }

  async toggleCategory(category: CandyAdminCategory): Promise<void> {
    this.updatingCategoryId.set(category.id);
    this.errorMessage.set('');
    try {
      const updated = await this.candyService.setCategoryActive(category.id, !category.active);
      this.categories.update(items => items.map(item => item.id === updated.id ? updated : item));
      if (this.editingCategoryId === updated.id) {
        this.categoryForm = { ...this.categoryForm, active: updated.active };
      }
      this.successMessage.set(updated.active ? 'Categoría activada.' : 'Categoría desactivada.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo cambiar el estado de la categoría.'));
    } finally {
      this.updatingCategoryId.set(null);
    }
  }

  async saveProduct(): Promise<void> {
    if (this.savingProduct()) return;
    this.errorMessage.set('');
    this.successMessage.set('');
    if (this.productForm.category_id <= 0) {
      this.errorMessage.set('Elegí una categoría para el producto.');
      return;
    }
    this.savingProduct.set(true);
    try {
      const saved = await this.candyService.saveProduct({
        ...this.productForm,
        name: this.productForm.name.trim(),
        description: this.productForm.description.trim(),
      }, this.editingProductId ?? undefined, this.imageFile ?? undefined, this.imageUrlInput);
      this.products.update(items => {
        const updated = this.editingProductId === null
          ? [...items, saved]
          : items.map(item => item.id === saved.id ? saved : item);
        return updated.sort((a, b) => a.categoryId - b.categoryId || a.name.localeCompare(b.name, 'es'));
      });
      this.resetProductForm();
      this.successMessage.set('Producto guardado.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo guardar el producto.'));
    } finally {
      this.savingProduct.set(false);
    }
  }

  editProduct(product: CandyAdminProduct): void {
    this.clearPreview();
    this.editingProductId = product.id;
    this.productForm = {
      category_id: product.categoryId,
      name: product.name,
      description: product.description,
      price: product.price,
      image_url: product.imagePath,
      is_combo: product.isCombo,
      is_featured: product.isFeatured,
      active: product.active,
    };
    this.imageFile = null;
    this.imageUrlInput = /^https?:\/\//i.test(product.imagePath) ? product.imagePath : '';
    this.imagePreview = product.imageUrl;
    this.savedImagePreview = product.imageUrl;
    this.errorMessage.set('');
  }

  resetProductForm(): void {
    this.clearPreview();
    this.editingProductId = null;
    this.productForm = emptyProduct();
    this.imageFile = null;
    this.imageUrlInput = '';
    this.imagePreview = '';
    this.savedImagePreview = '';
  }

  selectImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.clearPreview();
    this.imageFile = file;
    if (file) {
      this.imageUrlInput = '';
      this.imagePreview = URL.createObjectURL(file);
      this.previewObjectUrl = this.imagePreview;
    } else {
      this.imagePreview = this.savedImagePreview;
    }
  }

  setImageUrl(value: string, fileInput: HTMLInputElement): void {
    this.imageUrlInput = value;
    if (value.trim()) {
      this.imageFile = null;
      fileInput.value = '';
      this.clearPreview();
      this.imagePreview = value || this.savedImagePreview;
    }
  }

  async toggleProduct(product: CandyAdminProduct): Promise<void> {
    this.updatingProductId.set(product.id);
    this.errorMessage.set('');
    try {
      const updated = await this.candyService.setProductActive(product.id, !product.active);
      this.products.update(items => items.map(item => item.id === updated.id ? updated : item));
      if (this.editingProductId === updated.id) {
        this.productForm = { ...this.productForm, active: updated.active };
      }
      this.successMessage.set(updated.active ? 'Producto activado.' : 'Producto desactivado.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo cambiar el estado del producto.'));
    } finally {
      this.updatingProductId.set(null);
    }
  }

  categoryName(categoryId: number): string {
    return this.categories().find(category => category.id === categoryId)?.name ?? 'Sin categoría';
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price);
  }

  private clearPreview(): void {
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
    this.previewObjectUrl = null;
  }

  private message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
