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

  it('passes the selected eligible coupon and requested credit to the purchase RPC', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: 'discounted-booking-uuid', error: null });
    const checkoutWithBenefits = {
      ...purchaseData,
      couponCode: 'PRIMERACOMPRA',
      useCredit: 1250.5,
    };

    await expect(createService().purchase(checkoutWithBenefits)).resolves.toBe('discounted-booking-uuid');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('purchase_tickets', expect.objectContaining({
      p_coupon_code: 'PRIMERACOMPRA',
      p_use_credit: 1250.5,
    }));
  });

  it('propagates the RPC error for a candy-only purchase without clearing a seat hold', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Producto de candy no disponible' },
    });
    const candyOrder = {
      showtime: null,
      seats: [],
      candy: [{ product_id: 12, qty: 2 }],
      couponCode: null,
      useCredit: 0,
      contactEmail: 'guest@example.com',
      birthDate: '2000-02-03',
    };

    await expect(createService().purchase(candyOrder)).rejects.toThrow('Producto de candy no disponible');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('purchase_tickets', expect.objectContaining({
      p_showtime_id: null,
      p_seats: [],
      p_candy: [{ product_id: 12, qty: 2 }],
    }));
    expect(completePurchase).not.toHaveBeenCalled();
  });

  it('propagates the RPC error for a mixed purchase and does not complete the hold', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Crédito insuficiente' },
    });
    const mixedOrder = {
      ...purchaseData,
      candy: [{ product_id: 12, qty: 1 }],
      couponCode: 'CUPON20',
      useCredit: 9999,
    };

    await expect(createService().purchase(mixedOrder)).rejects.toThrow('Crédito insuficiente');
    expect(updateHold).toHaveBeenCalledWith(23, purchaseData.seats);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('purchase_tickets', expect.objectContaining({
      p_candy: mixedOrder.candy,
      p_coupon_code: 'CUPON20',
      p_use_credit: 9999,
    }));
    expect(completePurchase).not.toHaveBeenCalled();
  });

  it('loads only benefits returned by the eligible-coupons and credit RPCs', async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({
        data: [{ id: 3, code: 'PRIMERACOMPRA', type: 'primera_compra', percentage: '20', description: 'Primera compra' }],
        error: null,
      })
      .mockResolvedValueOnce({ data: '1500.75', error: null });
    const service = createService();

    await expect(service.getEligibleCoupons()).resolves.toEqual([
      { id: 3, code: 'PRIMERACOMPRA', type: 'primera_compra', percentage: 20, description: 'Primera compra' },
    ]);
    await expect(service.getCreditBalance()).resolves.toBe(1500.75);
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(1, 'eligible_coupons');
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(2, 'my_credit_balance');
  });

  it('returns the credit amount decided by cancel_booking', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: '4250.75', error: null });

    await expect(createService().cancelBooking('booking-to-cancel')).resolves.toBe(4250.75);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('cancel_booking', {
      p_booking_id: 'booking-to-cancel',
    });
  });

  it('shows cancel_booking errors without masking the server decision', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Solo se puede cancelar hasta 2 horas antes de la función' },
    });

    await expect(createService().cancelBooking('too-late-booking'))
      .rejects.toThrow('Solo se puede cancelar hasta 2 horas antes de la función');
  });
});
