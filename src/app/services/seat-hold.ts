import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './auth';
import { supabase } from '../supabase.client';

export interface ActiveSeatHold {
  showtimeId: number;
  seats: string[];
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class SeatHoldService {
  private authService = inject(AuthService);
  private router = inject(Router);
  private renewalTimer: ReturnType<typeof setTimeout> | null = null;
  private mutationQueue: Promise<void> = Promise.resolve();
  private navigationSubscription = this.router.events
    .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
    .subscribe(event => {
      const path = event.urlAfterRedirects.split('?')[0];
      const hold = this.activeHold();
      const remainsInCheckout =
        path === '/booking-summary' ||
        (!!hold && path === `/seats/${hold.showtimeId}`);
      if (!remainsInCheckout) void this.releaseActiveHoldSilently();
    });

  activeHold = signal<ActiveSeatHold | null>(null);
  holdError = signal('');

  getHeldSeats(showtimeId: number): string[] {
    const hold = this.activeHold();
    return hold?.showtimeId === showtimeId ? [...hold.seats] : [];
  }

  ownsSeat(showtimeId: number, seatLabel: string): boolean {
    const hold = this.activeHold();
    return hold?.showtimeId === showtimeId && hold.seats.includes(seatLabel);
  }

  async restoreHold(showtimeId: number): Promise<void> {
    const current = this.activeHold();
    if (current?.showtimeId === showtimeId) return;
    if (current && current.showtimeId !== showtimeId) {
      await this.releaseHold(current.showtimeId);
    }

    const { data, error } = await supabase
      .from('seat_holds')
      .select('seat_label,expires_at')
      .eq('showtime_id', showtimeId)
      .gt('expires_at', new Date().toISOString());
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    if (rows.length === 0) return;

    const seats = rows.map(row => row.seat_label);
    const expiresAt = Math.min(...rows.map(row => Date.parse(row.expires_at)));
    if (!Number.isFinite(expiresAt)) return;

    this.activeHold.set({ showtimeId, seats, expiresAt });
    this.holdError.set('');
    this.scheduleRenewal();
  }

  updateHold(showtimeId: number, seats: string[]): Promise<void> {
    return this.enqueue(() => this.performUpdateHold(showtimeId, seats));
  }

  releaseHold(showtimeId: number): Promise<void> {
    return this.enqueue(() => this.releaseForShowtime(showtimeId));
  }

  completePurchase(showtimeId: number): void {
    if (this.activeHold()?.showtimeId !== showtimeId) return;
    this.clearLocalHold();
  }

  private async releaseForShowtime(showtimeId: number): Promise<void> {
    const hold = this.activeHold();
    if (!hold || hold.showtimeId !== showtimeId) return;

    const { error } = await supabase.rpc('release_seats', {
      p_showtime_id: showtimeId,
      p_seats: null,
    });
    if (error) throw new Error(error.message);
    this.clearLocalHold();
  }

  private async performUpdateHold(showtimeId: number, seats: string[]): Promise<void> {
    const normalizedSeats = [...new Set(seats)];
    if (normalizedSeats.length === 0) {
      await this.releaseForShowtime(showtimeId);
      return;
    }

    const current = this.activeHold();
    if (current && current.showtimeId !== showtimeId) {
      await this.releaseForShowtime(current.showtimeId);
    }

    await this.authService.continueAsGuest();
    const { data, error } = await supabase.rpc('hold_seats', {
      p_showtime_id: showtimeId,
      p_seats: normalizedSeats,
    });
    if (error) throw new Error(error.message);

    const expiresAt = typeof data === 'string' ? Date.parse(data) : NaN;
    if (!Number.isFinite(expiresAt)) {
      throw new Error('No se pudo determinar el vencimiento del bloqueo de butacas.');
    }

    this.holdError.set('');
    this.activeHold.set({ showtimeId, seats: normalizedSeats, expiresAt });
    this.scheduleRenewal();
  }

  private async releaseActiveHoldSilently(): Promise<void> {
    const hold = this.activeHold();
    if (!hold) return;

    try {
      await this.releaseHold(hold.showtimeId);
    } catch (error) {
      // Si el navegador no puede liberar el bloqueo, la expiración en la base lo libera.
      console.warn('No se pudo liberar el bloqueo temporal:', error);
      this.clearLocalHold();
    }
  }

  private scheduleRenewal(): void {
    if (this.renewalTimer) clearTimeout(this.renewalTimer);
    const hold = this.activeHold();
    if (!hold) return;

    const delay = Math.max(1000, Math.floor((hold.expiresAt - Date.now()) * 0.7));
    this.renewalTimer = setTimeout(() => {
      const current = this.activeHold();
      if (!current || current.showtimeId !== hold.showtimeId) return;

      void this.renewCurrentHold(current).catch(error => {
        this.holdError.set(
          error instanceof Error
            ? error.message
            : 'No se pudo renovar el bloqueo de butacas.'
        );
      });
    }, delay);
  }

  private renewCurrentHold(expected: ActiveSeatHold): Promise<void> {
    return this.enqueue(async () => {
      const current = this.activeHold();
      const path = this.router.url.split('?')[0];
      const inCheckout = path === '/booking-summary' || path === `/seats/${expected.showtimeId}`;
      if (
        !inCheckout ||
        current?.showtimeId !== expected.showtimeId ||
        current.expiresAt !== expected.expiresAt
      ) {
        return;
      }

      try {
        await this.performUpdateHold(current.showtimeId, current.seats);
      } catch (error) {
        const latest = this.activeHold();
        if (latest?.showtimeId === expected.showtimeId && latest.expiresAt > Date.now()) {
          const retryDelay = Math.min(15_000, Math.max(1_000, latest.expiresAt - Date.now() - 500));
          this.renewalTimer = setTimeout(() => {
            void this.renewCurrentHold(latest).catch(retryError => {
              this.holdError.set(
                retryError instanceof Error
                  ? retryError.message
                  : 'No se pudo renovar el bloqueo de butacas.'
              );
            });
          }, retryDelay);
        }
        throw error;
      }
    });
  }

  private clearLocalHold(): void {
    if (this.renewalTimer) clearTimeout(this.renewalTimer);
    this.renewalTimer = null;
    this.activeHold.set(null);
    this.holdError.set('');
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}
