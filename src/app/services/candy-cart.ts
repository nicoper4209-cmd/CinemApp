import { Injectable, computed, signal } from '@angular/core';
import { CandyProduct } from '../models/candy';

export interface CandyCartItem {
  product: CandyProduct;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CandyCartService {
  private itemsState = signal<CandyCartItem[]>([]);
  items = this.itemsState.asReadonly();
  itemCount = computed(() => this.itemsState().reduce((sum, item) => sum + item.quantity, 0));
  subtotal = computed(() =>
    this.itemsState().reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  );

  add(product: CandyProduct): void {
    this.itemsState.update(items => {
      const existing = items.find(item => item.product.id === product.id);
      if (existing) {
        return items.map(item => item.product.id === product.id
          ? { ...item, product, quantity: Math.min(50, item.quantity + 1) }
          : item);
      }
      return [...items, { product, quantity: 1 }];
    });
  }

  setQuantity(productId: number, quantity: number): void {
    if (quantity <= 0) {
      this.remove(productId);
      return;
    }
    this.itemsState.update(items => items.map(item => item.product.id === productId
      ? { ...item, quantity: Math.min(50, Math.floor(quantity)) }
      : item));
  }

  remove(productId: number): void {
    this.itemsState.update(items => items.filter(item => item.product.id !== productId));
  }

  clear(): void {
    this.itemsState.set([]);
  }
}
