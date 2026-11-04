export type SeatType = 'standard' | 'accessible' | 'vip';

export interface SeatPricing {
  seatType: SeatType;
  basePrice: number;
  presalePrice: number;
}

export interface CinemaFormat {
  id: number;
  name: string;
  priceMultiplier: number;
  active: boolean;
}

export interface CinemaRoom {
  code: string;
  active: boolean;
}

export interface AppSetting {
  key: string;
  value: string;
  description: string;
}
