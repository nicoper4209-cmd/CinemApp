import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminCoupon, AdminReward, CouponType, RewardType } from '../../../models/promotions';
import { AdminPromotionsService, RewardInput } from '../../../services/admin-promotions';
import {
  COUPON_TYPES,
  dateToInstant,
  normalizeCouponCode,
  toArtDate,
  validateCouponCode,
  validateCouponDates,
  validateCouponMinAge,
  validateCouponPercentage,
  validatePointsCost,
  validateRewardName,
  validateRewardValue,
} from '../../../utils/admin-promotions-validation';

const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  credit: 'Crédito',
  candy: 'Candy',
  ticket: 'Entrada',
  other: 'Otro',
};

interface CouponForm {
  code: string;
  type: CouponType;
  percentage: number;
  minAge: number | null;
  active: boolean;
  validFrom: string;
  validUntil: string;
  description: string;
}

function emptyCoupon(): CouponForm {
  return {
    code: '',
    type: 'general',
    percentage: 10,
    minAge: null,
    active: true,
    validFrom: '',
    validUntil: '',
    description: '',
  };
}

function emptyReward(): RewardInput {
  return {
    name: '',
    description: '',
    pointsCost: 100,
    rewardType: 'credit',
    rewardValue: 0,
    active: true,
  };
}

@Component({
  selector: 'app-admin-promotions',
  imports: [FormsModule],
  templateUrl: './admin-promotions.html',
  styleUrl: './admin-promotions.css',
})
export class AdminPromotions {
  private promotionsService = inject(AdminPromotionsService);

  readonly couponTypes = COUPON_TYPES;
  readonly rewardTypes = (Object.keys(REWARD_TYPE_LABELS) as RewardType[])
    .map(value => ({ value, label: REWARD_TYPE_LABELS[value] }));

  coupons = signal<AdminCoupon[]>([]);
  rewards = signal<AdminReward[]>([]);
  loading = signal(true);
  saving = signal<'' | 'coupon' | 'reward'>('');
  errorMessage = signal('');
  successMessage = signal('');

  couponForm = emptyCoupon();
  editingCouponId: number | null = null;
  rewardForm = emptyReward();
  editingRewardId: number | null = null;

  constructor() {
    void this.loadPromotions();
  }

  async loadPromotions(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const [coupons, rewards] = await Promise.all([
        this.promotionsService.getCoupons(),
        this.promotionsService.getRewards(),
      ]);
      this.coupons.set(coupons);
      this.rewards.set(rewards);
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudieron cargar los cupones y premios.'));
    } finally {
      this.loading.set(false);
    }
  }

  couponTypeLabel(type: CouponType): string {
    return COUPON_TYPES.find(item => item.value === type)?.label ?? type;
  }

  rewardTypeLabel(type: RewardType): string {
    return REWARD_TYPE_LABELS[type] ?? type;
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  }

  formatDate(value: string | null): string {
    const date = toArtDate(value);
    if (!date) return 'Sin límite';
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }

  onCouponTypeChange(type: CouponType): void {
    if (type === 'mayor_50' && (this.couponForm.minAge === null || this.couponForm.minAge < 1)) {
      this.couponForm.minAge = 50;
    }
  }

  async saveCoupon(): Promise<void> {
    if (this.saving()) return;
    this.clearMessages();
    const error = validateCouponCode(this.couponForm.code)
      ?? validateCouponPercentage(this.couponForm.percentage)
      ?? validateCouponMinAge(this.couponForm.type, this.couponForm.minAge)
      ?? validateCouponDates(this.couponForm.validFrom, this.couponForm.validUntil);
    if (error) {
      this.errorMessage.set(error);
      return;
    }

    this.saving.set('coupon');
    try {
      const saved = await this.promotionsService.saveCoupon({
        code: normalizeCouponCode(this.couponForm.code),
        type: this.couponForm.type,
        percentage: Number(this.couponForm.percentage),
        minAge: this.couponForm.minAge === null ? null : Number(this.couponForm.minAge),
        active: this.couponForm.active,
        validFrom: dateToInstant(this.couponForm.validFrom, 'start'),
        validUntil: dateToInstant(this.couponForm.validUntil, 'end'),
        description: this.couponForm.description.trim(),
      }, this.editingCouponId ?? undefined);
      this.coupons.update(items => {
        const updated = this.editingCouponId === null
          ? [...items, saved]
          : items.map(item => item.id === saved.id ? saved : item);
        return updated.sort((a, b) => a.code.localeCompare(b.code, 'es'));
      });
      this.resetCouponForm();
      this.successMessage.set('Cupón guardado.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo guardar el cupón.'));
    } finally {
      this.saving.set('');
    }
  }

  editCoupon(coupon: AdminCoupon): void {
    this.editingCouponId = coupon.id;
    this.couponForm = {
      code: coupon.code,
      type: coupon.type,
      percentage: coupon.percentage,
      minAge: coupon.minAge,
      active: coupon.active,
      validFrom: toArtDate(coupon.validFrom),
      validUntil: toArtDate(coupon.validUntil),
      description: coupon.description,
    };
    this.clearMessages();
  }

  resetCouponForm(): void {
    this.editingCouponId = null;
    this.couponForm = emptyCoupon();
  }

  async toggleCoupon(coupon: AdminCoupon): Promise<void> {
    if (this.saving()) return;
    this.clearMessages();
    this.saving.set('coupon');
    try {
      const updated = await this.promotionsService.setCouponActive(coupon.id, !coupon.active);
      this.coupons.update(items => items.map(item => item.id === updated.id ? updated : item));
      if (this.editingCouponId === updated.id) {
        this.couponForm = { ...this.couponForm, active: updated.active };
      }
      this.successMessage.set(updated.active ? 'Cupón activado.' : 'Cupón desactivado.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo cambiar el estado del cupón.'));
    } finally {
      this.saving.set('');
    }
  }

  async saveReward(): Promise<void> {
    if (this.saving()) return;
    this.clearMessages();
    const error = validateRewardName(this.rewardForm.name)
      ?? validatePointsCost(this.rewardForm.pointsCost)
      ?? validateRewardValue(this.rewardForm.rewardType, this.rewardForm.rewardValue);
    if (error) {
      this.errorMessage.set(error);
      return;
    }

    this.saving.set('reward');
    try {
      const saved = await this.promotionsService.saveReward({
        name: this.rewardForm.name.trim(),
        description: this.rewardForm.description.trim(),
        pointsCost: Number(this.rewardForm.pointsCost),
        rewardType: this.rewardForm.rewardType,
        rewardValue: Number(this.rewardForm.rewardValue),
        active: this.rewardForm.active,
      }, this.editingRewardId ?? undefined);
      this.rewards.update(items => {
        const updated = this.editingRewardId === null
          ? [...items, saved]
          : items.map(item => item.id === saved.id ? saved : item);
        return updated.sort((a, b) => a.pointsCost - b.pointsCost || a.name.localeCompare(b.name, 'es'));
      });
      this.resetRewardForm();
      this.successMessage.set('Premio guardado.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo guardar el premio.'));
    } finally {
      this.saving.set('');
    }
  }

  editReward(reward: AdminReward): void {
    this.editingRewardId = reward.id;
    this.rewardForm = {
      name: reward.name,
      description: reward.description,
      pointsCost: reward.pointsCost,
      rewardType: reward.rewardType,
      rewardValue: reward.rewardValue,
      active: reward.active,
    };
    this.clearMessages();
  }

  resetRewardForm(): void {
    this.editingRewardId = null;
    this.rewardForm = emptyReward();
  }

  async toggleReward(reward: AdminReward): Promise<void> {
    if (this.saving()) return;
    this.clearMessages();
    this.saving.set('reward');
    try {
      const updated = await this.promotionsService.setRewardActive(reward.id, !reward.active);
      this.rewards.update(items => items.map(item => item.id === updated.id ? updated : item));
      if (this.editingRewardId === updated.id) {
        this.rewardForm = { ...this.rewardForm, active: updated.active };
      }
      this.successMessage.set(updated.active ? 'Premio activado.' : 'Premio desactivado.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo cambiar el estado del premio.'));
    } finally {
      this.saving.set('');
    }
  }

  private clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  private message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
