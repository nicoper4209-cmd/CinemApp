import '@angular/compiler';
import { Injector } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../supabase.client', () => ({ supabase: supabaseMock }));

import { SeatHoldService } from './seat-hold';

describe('SeatHoldService conflict handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('surfaces a server conflict and does not claim the seats locally', async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Una o más butacas ya no están disponibles.' },
    });
    const routerMock = { events: new Subject(), url: '/seats/23' };
    const injector = Injector.create({
      providers: [
        SeatHoldService,
        { provide: AuthService, useValue: { continueAsGuest: vi.fn().mockResolvedValue(null) } },
        { provide: Router, useValue: routerMock },
      ],
    });
    const service = injector.get(SeatHoldService);

    await expect(service.updateHold(23, ['A-1-4']))
      .rejects.toThrow('Una o más butacas ya no están disponibles.');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('hold_seats', {
      p_showtime_id: 23,
      p_seats: ['A-1-4'],
    });
    expect(service.activeHold()).toBeNull();
    injector.destroy();
  });
});
