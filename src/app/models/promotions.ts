export type CouponType = 'primera_compra' | 'mayor_50' | 'general';

export interface AdminCoupon {
  id: number;
  code: string;
  type: CouponType;
  percentage: number;
  minAge: number | null;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  description: string;
}

export type RewardType = 'credit' | 'candy' | 'ticket' | 'other';

export interface AdminReward {
  id: number;
  name: string;
  description: string;
  pointsCost: number;
  rewardType: RewardType;
  rewardValue: number;
  active: boolean;
}
