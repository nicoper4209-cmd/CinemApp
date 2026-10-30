import { Component, computed, inject, signal } from '@angular/core';
import { CandyCategory } from '../../models/candy';
import { CandyService } from '../../services/candy';

@Component({
  selector: 'app-candy-shop',
  templateUrl: './candy-shop.html',
  styleUrl: './candy-shop.css',
})
export class CandyShop {
  private candyService = inject(CandyService);

  categories = signal<CandyCategory[]>([]);
  hasFeaturedProducts = computed(() =>
    this.categories().some(category => category.products.some(product => product.isFeatured))
  );
  hasCombos = computed(() =>
    this.categories().some(category => category.products.some(product => product.isCombo))
  );
  loading = signal(true);
  errorMessage = signal('');

  constructor() {
    void this.loadCatalog();
  }

  async loadCatalog(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.categories.set(await this.candyService.getCatalog());
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'No se pudo cargar el menú de Candy.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2,
    }).format(price);
  }
}
