import { Injectable } from '@angular/core';
import { Movie } from '../models/movie';
import { Showtime } from '../models/showtime';
import { supabase } from '../supabase.client';

export interface TicketPriceEstimate {
  seatPrices: Record<string, number>;
  total: number;
  standardPrice: number;
  accessiblePrice: number;
  vipPrice: number;
  formatName: string;
  formatMultiplier: number;
  presale: boolean;
}

interface PricingRow {
  seat_type: 'standard' | 'accessible' | 'vip';
  base_price: number;
  presale_price: number;
}

@Injectable({ providedIn: 'root' })
export class PricingService {
  private pricingConfigPromise?: Promise<Map<PricingRow['seat_type'], PricingRow>>;
  private presaleDaysPromise?: Promise<number>;
  private formatPromises = new Map<number, Promise<{ name: string; multiplier: number }>>();

  async estimateTickets(
    movie: Movie,
    showtime: Showtime,
    seats: string[]
  ): Promise<TicketPriceEstimate> {
    const [pricing, presaleDays, format] = await Promise.all([
      this.getPricingConfig(),
      this.getPresaleDays(),
      this.getFormat(showtime.formatId ?? null),
    ]);

    const presale = this.isPresale(movie.releaseDate ?? null, presaleDays);
    const prices = new Map<PricingRow['seat_type'], number>();
    for (const seatType of ['standard', 'accessible', 'vip'] as const) {
      const config = pricing.get(seatType);
      if (!config) throw new Error(`Falta configurar el precio de butaca ${seatType}.`);
      const base = presale ? Number(config.presale_price) : Number(config.base_price);
      prices.set(seatType, Math.round(base * format.multiplier * 100) / 100);
    }

    const seatPrices: Record<string, number> = {};
    for (const seat of seats) seatPrices[seat] = prices.get(this.seatType(seat))!;

    return {
      seatPrices,
      total: seats.reduce((sum, seat) => sum + (seatPrices[seat] ?? 0), 0),
      standardPrice: prices.get('standard')!,
      accessiblePrice: prices.get('accessible')!,
      vipPrice: prices.get('vip')!,
      formatName: format.name,
      formatMultiplier: format.multiplier,
      presale,
    };
  }

  private async getPricingConfig(): Promise<Map<PricingRow['seat_type'], PricingRow>> {
    this.pricingConfigPromise ??= (async () => {
      const { data, error } = await supabase
        .from('pricing_config')
        .select('seat_type,base_price,presale_price');
      if (error) throw new Error(error.message);
      return new Map((data ?? []).map(row => [row.seat_type as PricingRow['seat_type'], row as PricingRow]));
    })();

    try {
      return await this.pricingConfigPromise;
    } catch (error) {
      this.pricingConfigPromise = undefined;
      throw error;
    }
  }

  private async getPresaleDays(): Promise<number> {
    this.presaleDaysPromise ??= (async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'presale_days')
        .maybeSingle();
      if (error) throw new Error(error.message);
      const value = Number(data?.value ?? 7);
      return Number.isInteger(value) && value >= 0 ? value : 7;
    })();

    try {
      return await this.presaleDaysPromise;
    } catch (error) {
      this.presaleDaysPromise = undefined;
      throw error;
    }
  }

  private async getFormat(formatId: number | null): Promise<{ name: string; multiplier: number }> {
    if (formatId === null) return { name: '2D', multiplier: 1 };

    let formatPromise = this.formatPromises.get(formatId);
    if (!formatPromise) {
      formatPromise = (async () => {
        const { data, error } = await supabase
          .from('formats')
          .select('name,price_multiplier')
          .eq('id', formatId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return { name: 'Formato', multiplier: 1 };
        return { name: data.name, multiplier: Number(data.price_multiplier) || 1 };
      })();
      this.formatPromises.set(formatId, formatPromise);
    }

    try {
      return await formatPromise;
    } catch (error) {
      this.formatPromises.delete(formatId);
      throw error;
    }
  }

  private seatType(label: string): PricingRow['seat_type'] {
    const row = label.split('-')[0];
    if (row === 'J' || row === 'K') return 'accessible';
    if (row === 'R' || row === 'S' || row === 'T') return 'vip';
    return 'standard';
  }

  private isPresale(releaseDate: string | null, presaleDays: number): boolean {
    if (!releaseDate) return false;
    const todayParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      todayParts.find(item => item.type === type)?.value ?? '';
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    if (releaseDate <= today) return false;

    const daysUntilRelease =
      (Date.parse(`${releaseDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86_400_000;
    return daysUntilRelease <= presaleDays;
  }
}
