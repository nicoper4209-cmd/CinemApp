import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CandyCategory } from '../../models/candy';
import { CandyProduct } from '../../models/candy';
import { CandyService } from '../../services/candy';
import { CandyCartService } from '../../services/candy-cart';

@Component({
  selector: 'app-candy-shop',
  templateUrl: './candy-shop.html',
  styleUrl: './candy-shop.css',
})
export class CandyShop {
  private candyService = inject(CandyService);
  private router = inject(Router);
  cart = inject(CandyCartService);

  categories = signal<CandyCategory[]>([]);
  hasFeaturedProducts = computed(() =>
    this.categories().some(category => category.products.some(product => product.isFeatured))
  );
  hasCombos = computed(() =>
    this.categories().some(category => category.products.some(product => product.isCombo))
  );
  loading = signal(true);
  errorMessage = signal('');
  private returnToCheckout = (history.state as { checkout?: Record<string, unknown> } | null)?.checkout;

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

  addToCart(product: CandyProduct): void {
    this.cart.add(product);
  }

  checkout(): void {
    if (this.cart.itemCount() === 0) return;
    void this.router.navigate(['/booking-summary'], {
      state: this.returnToCheckout ?? { candyOnly: true },
    });
  }
}
