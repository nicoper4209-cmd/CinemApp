import { Injectable } from '@angular/core';
import { AdminCoupon, AdminReward, CouponType, RewardType } from '../models/promotions';
import { supabase } from '../supabase.client';

interface CouponRow {
  id: number;
  code: string;
  type: CouponType;
  percentage: number | string;
  min_age: number | null;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  description: string;
}

interface RewardRow {
  id: number;
  name: string;
  description: string;
  points_cost: number;
  reward_type: RewardType;
  reward_value: number | string;
  active: boolean;
}

export interface CouponInput {
  code: string;
  type: CouponType;
  percentage: number;
  minAge: number | null;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  description: string;
}

export interface RewardInput {
  name: string;
  description: string;
  pointsCost: number;
  rewardType: RewardType;
  rewardValue: number;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminPromotionsService {
  async getCoupons(): Promise<AdminCoupon[]> {
    const { data, error } = await supabase
      .from('coupons')
      .select('id,code,type,percentage,min_age,active,valid_from,valid_until,description')
      .order('code', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as CouponRow[]).map(row => this.mapCoupon(row));
  }

  async saveCoupon(input: CouponInput, id?: number): Promise<AdminCoupon> {
    const payload = {
      code: input.code,
      type: input.type,
      percentage: input.percentage,
      min_age: input.minAge,
      active: input.active,
      valid_from: input.validFrom,
      valid_until: input.validUntil,
      description: input.description,
    };
    const query = id === undefined
      ? supabase.from('coupons').insert(payload)
      : supabase.from('coupons').update(payload).eq('id', id);
    const { data, error } = await query
      .select('id,code,type,percentage,min_age,active,valid_from,valid_until,description')
      .single();
    if (error) throw new Error(error.message);
    return this.mapCoupon(data as CouponRow);
  }

  async setCouponActive(id: number, active: boolean): Promise<AdminCoupon> {
    const { data, error } = await supabase
      .from('coupons')
      .update({ active })
      .eq('id', id)
      .select('id,code,type,percentage,min_age,active,valid_from,valid_until,description')
      .single();
    if (error) throw new Error(error.message);
    return this.mapCoupon(data as CouponRow);
  }

  async getRewards(): Promise<AdminReward[]> {
    const { data, error } = await supabase
      .from('rewards')
      .select('id,name,description,points_cost,reward_type,reward_value,active')
      .order('points_cost', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as RewardRow[]).map(row => this.mapReward(row));
  }

  async saveReward(input: RewardInput, id?: number): Promise<AdminReward> {
    const payload = {
      name: input.name,
      description: input.description,
      points_cost: input.pointsCost,
      reward_type: input.rewardType,
      reward_value: input.rewardValue,
      active: input.active,
    };
    const query = id === undefined
      ? supabase.from('rewards').insert(payload)
      : supabase.from('rewards').update(payload).eq('id', id);
    const { data, error } = await query
      .select('id,name,description,points_cost,reward_type,reward_value,active')
      .single();
    if (error) throw new Error(error.message);
    return this.mapReward(data as RewardRow);
  }

  async setRewardActive(id: number, active: boolean): Promise<AdminReward> {
    const { data, error } = await supabase
      .from('rewards')
      .update({ active })
      .eq('id', id)
      .select('id,name,description,points_cost,reward_type,reward_value,active')
      .single();
    if (error) throw new Error(error.message);
    return this.mapReward(data as RewardRow);
  }

  private mapCoupon(row: CouponRow): AdminCoupon {
    return {
      id: row.id,
      code: row.code,
      type: row.type,
      percentage: Number(row.percentage),
      minAge: row.min_age,
      active: row.active,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      description: row.description,
    };
  }

  private mapReward(row: RewardRow): AdminReward {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      pointsCost: row.points_cost,
      rewardType: row.reward_type,
      rewardValue: Number(row.reward_value),
      active: row.active,
    };
  }
}
