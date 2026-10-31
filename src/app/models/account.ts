export interface PointsMovement {
  id: number;
  delta: number;
  reason: string;
  bookingId: string | null;
  note: string;
  createdAt: string;
}

export interface CreditMovement {
  id: number;
  delta: number;
  reason: string;
  bookingId: string | null;
  createdAt: string;
}

export interface Reward {
  id: number;
  name: string;
  description: string;
  pointsCost: number;
  rewardType: 'credit' | 'candy' | 'ticket' | 'other';
  rewardValue: number;
}

export interface RewardRedemptionResult {
  ok: boolean;
  reward: string;
  code: string;
}
