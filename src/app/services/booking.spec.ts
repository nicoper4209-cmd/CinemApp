import '@angular/compiler';
import { Injector } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MovieService } from './movie';
import { ShowtimeService } from './showtime';
import { SeatHoldService } from './seat-hold';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../supabase.client', () => ({ supabase: supabaseMock }));

import { BookingService } from './booking';

describe('BookingService purchase contract', () => {
  const updateHold = vi.fn();
  const completePurchase = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createService(): BookingService {
    return Injector.create({
      providers: [
        BookingService,
        { provide: MovieService, useValue: {} },
        { provide: ShowtimeService, useValue: {} },
        { provide: SeatHoldService, useValue: { updateHold, completePurchase } },
      ],
    }).get(BookingService);
  }

  const purchaseData = {
    movie: { id: 4 } as never,
    showtime: { id: 23 } as never,
    seats: ['A-1-4', 'A-1-5'],
    contactEmail: 'guest@example.com',
    birthDate: '2000-02-03',
  };

  it('confirms only after the purchase RPC succeeds, then clears the hold', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 'booking-uuid', error: null });
    const service = createService();

    await expect(service.purchase(purchaseData)).resolves.toBe('booking-uuid');
    expect(updateHold).toHaveBeenCalledWith(23, purchaseData.seats);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('purchase_tickets', {
      p_showtime_id: 23,
      p_seats: purchaseData.seats,
      p_candy: [],
      p_coupon_code: null,
      p_use_credit: 0,
      p_payment_method: 'mock',
      p_contact_email: 'guest@example.com',
      p_birth_date: '2000-02-03',
    });
    expect(completePurchase).toHaveBeenCalledWith(23);
  });

  it('keeps the hold and returns the authoritative server error when purchase fails', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: 'Age restriction: +13' } });

    await expect(createService().purchase(purchaseData))
      .rejects.toThrow('Age restriction: +13');
    expect(completePurchase).not.toHaveBeenCalled();
  });

  it('does not call purchase when the hold conflicts or has expired', async () => {
    updateHold.mockRejectedValueOnce(new Error('Seat hold expired or unavailable'));

    await expect(createService().purchase(purchaseData))
      .rejects.toThrow('Seat hold expired or unavailable');
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    expect(completePurchase).not.toHaveBeenCalled();
  });

  it('supports a candy-only purchase without creating or completing a seat hold', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 'candy-booking-uuid', error: null });
    const candyOrder = {
      showtime: null,
      seats: [],
      candy: [{ product_id: 12, qty: 2 }],
      contactEmail: 'guest@example.com',
      birthDate: '2000-02-03',
    };

    await expect(createService().purchase(candyOrder)).resolves.toBe('candy-booking-uuid');
    expect(updateHold).not.toHaveBeenCalled();
    expect(completePurchase).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('purchase_tickets', expect.objectContaining({
      p_showtime_id: null,
      p_seats: [],
      p_candy: [{ product_id: 12, qty: 2 }],
    }));
  });

  it('sends candy and held seats together in the same atomic RPC call', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 'mixed-booking-uuid', error: null });
    const mixedOrder = {
      ...purchaseData,
      candy: [{ product_id: 7, qty: 1 }, { product_id: 12, qty: 2 }],
    };

    await expect(createService().purchase(mixedOrder)).resolves.toBe('mixed-booking-uuid');
    expect(updateHold).toHaveBeenCalledWith(23, purchaseData.seats);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('purchase_tickets', expect.objectContaining({
      p_showtime_id: 23,
      p_seats: purchaseData.seats,
      p_candy: mixedOrder.candy,
    }));
    expect(completePurchase).toHaveBeenCalledWith(23);
  });
});
