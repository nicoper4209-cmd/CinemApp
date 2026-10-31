import { Injectable, signal } from '@angular/core';
import { CreditMovement, PointsMovement, Reward, RewardRedemptionResult } from '../models/account';
import { supabase } from '../supabase.client';

interface PointsMovementRow {
  id: number;
  delta: number;
  reason: string;
  booking_id: string | null;
  note: string;
  created_at: string;
}

interface CreditMovementRow {
  id: number;
  delta: number | string;
  reason: string;
  booking_id: string | null;
  created_at: string;
}

interface RewardRow {
  id: number;
  name: string;
  description: string;
  points_cost: number;
  reward_type: Reward['rewardType'];
  reward_value: number | string;
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  pointsBalance = signal(0);
  creditBalance = signal(0);
  pointsMovements = signal<PointsMovement[]>([]);
  creditMovements = signal<CreditMovement[]>([]);
  rewards = signal<Reward[]>([]);
  loading = signal(false);
  errorMessage = signal('');

  async loadAccount(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await Promise.all([
        this.refreshBalances(),
        this.loadMovements(),
        this.loadRewards(),
      ]);
    } catch (error) {
      this.errorMessage.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  async refreshBalances(): Promise<void> {
    const [pointsResult, creditResult] = await Promise.all([
      supabase.rpc('my_points_balance'),
      supabase.rpc('my_credit_balance'),
    ]);
    if (pointsResult.error) throw new Error(pointsResult.error.message);
    if (creditResult.error) throw new Error(creditResult.error.message);
    this.pointsBalance.set(Number(pointsResult.data ?? 0));
    this.creditBalance.set(Number(creditResult.data ?? 0));
  }

  async refreshBalancesAndMovements(): Promise<void> {
    await Promise.all([this.refreshBalances(), this.loadMovements()]);
  }

  private async loadMovements(): Promise<void> {
    const [pointsResult, creditResult] = await Promise.all([
      supabase
        .from('points_ledger')
        .select('id,delta,reason,booking_id,note,created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('credit_ledger')
        .select('id,delta,reason,booking_id,created_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    if (pointsResult.error) throw new Error(pointsResult.error.message);
    if (creditResult.error) throw new Error(creditResult.error.message);

    this.pointsMovements.set(((pointsResult.data ?? []) as PointsMovementRow[]).map(row => ({
      id: row.id,
      delta: row.delta,
      reason: row.reason,
      bookingId: row.booking_id,
      note: row.note,
      createdAt: row.created_at,
    })));
    this.creditMovements.set(((creditResult.data ?? []) as CreditMovementRow[]).map(row => ({
      id: row.id,
      delta: Number(row.delta),
      reason: row.reason,
      bookingId: row.booking_id,
      createdAt: row.created_at,
    })));
  }

  private async loadRewards(): Promise<void> {
    const { data, error } = await supabase
      .from('rewards')
      .select('id,name,description,points_cost,reward_type,reward_value')
      .eq('active', true)
      .order('points_cost', { ascending: true });
    if (error) throw new Error(error.message);
    this.rewards.set(((data ?? []) as RewardRow[]).map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      pointsCost: row.points_cost,
      rewardType: row.reward_type,
      rewardValue: Number(row.reward_value),
    })));
  }

  async redeemReward(rewardId: number): Promise<RewardRedemptionResult> {
    const { data, error } = await supabase.rpc('redeem_reward', { p_reward_id: rewardId });
    if (error) throw new Error(error.message);
    const result = data as RewardRedemptionResult | null;
    if (!result?.ok) throw new Error('No se pudo completar el canje.');
    await this.loadAccount();
    return result;
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : 'No se pudo cargar la información de tu cuenta.';
  }
}
