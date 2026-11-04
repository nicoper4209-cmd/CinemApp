import { inject, Injectable } from '@angular/core';
import { AppSetting, CinemaFormat, CinemaRoom, SeatPricing, SeatType } from '../models/admin-config';
import { supabase } from '../supabase.client';
import { PricingService } from './pricing';

interface PricingRow {
  seat_type: SeatType;
  base_price: number | string;
  presale_price: number | string;
}

interface FormatRow {
  id: number;
  name: string;
  price_multiplier: number | string;
  active: boolean;
}

interface RoomRow {
  code: string;
  active: boolean;
}

interface SettingRow {
  key: string;
  value: string;
  description: string;
}

export interface AdminConfigSnapshot {
  pricing: SeatPricing[];
  formats: CinemaFormat[];
  rooms: CinemaRoom[];
  settings: AppSetting[];
}

export interface FormatInput {
  name: string;
  priceMultiplier: number;
  active: boolean;
}

const SEAT_TYPES: SeatType[] = ['standard', 'accessible', 'vip'];

@Injectable({ providedIn: 'root' })
export class AdminConfigService {
  private pricingService = inject(PricingService);

  async getConfig(): Promise<AdminConfigSnapshot> {
    const [pricingResult, formatsResult, roomsResult, settingsResult] = await Promise.all([
      supabase.from('pricing_config').select('seat_type,base_price,presale_price'),
      supabase.from('formats').select('id,name,price_multiplier,active').order('name', { ascending: true }),
      supabase.from('rooms').select('code,active').order('code', { ascending: true }),
      supabase.from('app_settings').select('key,value,description').order('key', { ascending: true }),
    ]);

    if (pricingResult.error) throw new Error(pricingResult.error.message);
    if (formatsResult.error) throw new Error(formatsResult.error.message);
    if (roomsResult.error) throw new Error(roomsResult.error.message);
    if (settingsResult.error) throw new Error(settingsResult.error.message);

    const pricingByType = new Map(
      ((pricingResult.data ?? []) as PricingRow[]).map(row => [row.seat_type, row] as const),
    );

    return {
      pricing: SEAT_TYPES.map(seatType => {
        const row = pricingByType.get(seatType);
        return {
          seatType,
          basePrice: Number(row?.base_price ?? 0),
          presalePrice: Number(row?.presale_price ?? 0),
        };
      }),
      formats: ((formatsResult.data ?? []) as FormatRow[]).map(format => ({
        id: format.id,
        name: format.name,
        priceMultiplier: Number(format.price_multiplier),
        active: format.active,
      })),
      rooms: ((roomsResult.data ?? []) as RoomRow[]).map(room => ({
        code: room.code,
        active: room.active,
      })),
      settings: ((settingsResult.data ?? []) as SettingRow[]).map(setting => ({
        key: setting.key,
        value: setting.value,
        description: setting.description,
      })),
    };
  }

  async savePricing(pricing: SeatPricing[]): Promise<void> {
    const { error } = await supabase
      .from('pricing_config')
      .upsert(pricing.map(row => ({
        seat_type: row.seatType,
        base_price: row.basePrice,
        presale_price: row.presalePrice,
      })), { onConflict: 'seat_type' });
    if (error) throw new Error(error.message);
    this.pricingService.invalidate();
  }

  async saveFormat(input: FormatInput, id?: number): Promise<CinemaFormat> {
    const payload = {
      name: input.name,
      price_multiplier: input.priceMultiplier,
      active: input.active,
    };
    const query = id === undefined
      ? supabase.from('formats').insert(payload)
      : supabase.from('formats').update(payload).eq('id', id);
    const { data, error } = await query.select('id,name,price_multiplier,active').single();
    if (error) throw new Error(error.message);
    const row = data as FormatRow;
    this.pricingService.invalidate();
    return {
      id: row.id,
      name: row.name,
      priceMultiplier: Number(row.price_multiplier),
      active: row.active,
    };
  }

  async createRoom(code: string): Promise<CinemaRoom> {
    const { data, error } = await supabase
      .from('rooms')
      .insert({ code, active: true })
      .select('code,active')
      .single();
    if (error) throw new Error(error.message);
    const row = data as RoomRow;
    return { code: row.code, active: row.active };
  }

  async setRoomActive(code: string, active: boolean): Promise<CinemaRoom> {
    const { data, error } = await supabase
      .from('rooms')
      .update({ active })
      .eq('code', code)
      .select('code,active')
      .single();
    if (error) throw new Error(error.message);
    const row = data as RoomRow;
    return { code: row.code, active: row.active };
  }

  async saveSetting(key: string, value: string): Promise<AppSetting> {
    const { data, error } = await supabase
      .from('app_settings')
      .update({ value: value.trim(), updated_at: new Date().toISOString() })
      .eq('key', key)
      .select('key,value,description')
      .single();
    if (error) throw new Error(error.message);
    const row = data as SettingRow;
    this.pricingService.invalidate();
    return { key: row.key, value: row.value, description: row.description };
  }
}
