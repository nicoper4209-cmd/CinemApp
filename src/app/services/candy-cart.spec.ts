import { describe, expect, it } from 'vitest';
import { CandyProduct } from '../models/candy';
import { CandyCartService } from './candy-cart';

const popcorn: CandyProduct = {
  id: 1,
  categoryId: 1,
  name: 'Pochoclos grandes',
  description: '',
  price: 3500,
  imageUrl: '',
  isCombo: false,
  isFeatured: false,
};

describe('CandyCartService', () => {
  it('aggregates quantities and subtotal, and removes an item at zero', () => {
    const cart = new CandyCartService();
    cart.add(popcorn);
    cart.add(popcorn);

    expect(cart.items()).toEqual([{ product: popcorn, quantity: 2 }]);
    expect(cart.itemCount()).toBe(2);
    expect(cart.subtotal()).toBe(7000);

    cart.setQuantity(popcorn.id, 0);
    expect(cart.items()).toEqual([]);
    expect(cart.subtotal()).toBe(0);
  });

  it('caps each product quantity to the RPC maximum', () => {
    const cart = new CandyCartService();
    cart.add(popcorn);
    cart.setQuantity(popcorn.id, 80);
    expect(cart.items()[0].quantity).toBe(50);
  });
});
