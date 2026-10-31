import { Component, inject, signal } from '@angular/core';
import { AccountService } from '../../services/account';
import { Reward } from '../../models/account';

@Component({
  selector: 'app-account',
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account {
  account = inject(AccountService);
  redeemingRewardId = signal<number | null>(null);
  actionMessage = signal('');
  actionError = signal('');

  constructor() {
    void this.account.loadAccount();
  }

  async redeem(reward: Reward): Promise<void> {
    if (this.redeemingRewardId() !== null) return;
    this.redeemingRewardId.set(reward.id);
    this.actionMessage.set('');
    this.actionError.set('');
    try {
      const result = await this.account.redeemReward(reward.id);
      this.actionMessage.set(
        result.code
          ? `Canjeaste ${result.reward}. Código: ${result.code}`
          : `Canjeaste ${result.reward}.`
      );
    } catch (error) {
      this.actionError.set(
        error instanceof Error ? error.message : 'No se pudo completar el canje.'
      );
    } finally {
      this.redeemingRewardId.set(null);
    }
  }

  formatPrice(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2,
    }).format(amount);
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  movementLabel(reason: string): string {
    const labels: Record<string, string> = {
      purchase: 'Compra',
      cancellation: 'Cancelación',
      reward_redemption: 'Canje de premio',
      reward: 'Crédito por premio',
      adjustment: 'Ajuste',
    };
    return labels[reason] ?? reason;
  }
}
