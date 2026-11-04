import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppSetting, CinemaFormat, CinemaRoom, SeatPricing, SeatType } from '../../../models/admin-config';
import { AdminConfigService, FormatInput } from '../../../services/admin-config';
import {
  SETTING_RULES,
  SettingRule,
  normalizeRoomCode,
  validateFormatMultiplier,
  validateFormatName,
  validateIntegerSetting,
  validatePrice,
  validateRoomCode,
} from '../../../utils/admin-config-validation';

const SEAT_TYPE_LABELS: Record<SeatType, string> = {
  standard: 'Estándar',
  accessible: 'Accesible',
  vip: 'VIP',
};

interface SettingField {
  rule: SettingRule;
  setting: AppSetting;
}

function emptyFormat(): FormatInput {
  return { name: '', priceMultiplier: 1, active: true };
}

@Component({
  selector: 'app-admin-config',
  imports: [FormsModule],
  templateUrl: './admin-config.html',
  styleUrl: './admin-config.css',
})
export class AdminConfig {
  private configService = inject(AdminConfigService);

  readonly settingRules = SETTING_RULES;
  loading = signal(true);
  saving = signal<'' | 'pricing' | 'format' | 'room' | 'settings'>('');
  errorMessage = signal('');
  successMessage = signal('');

  pricing: SeatPricing[] = [];
  formats = signal<CinemaFormat[]>([]);
  rooms = signal<CinemaRoom[]>([]);
  settingFields: SettingField[] = [];

  formatForm = emptyFormat();
  editingFormatId: number | null = null;
  roomCode = '';

  private savedSettings = new Map<string, string>();

  constructor() {
    void this.loadConfig();
  }

  async loadConfig(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      const snapshot = await this.configService.getConfig();
      this.pricing = snapshot.pricing;
      this.formats.set(snapshot.formats);
      this.rooms.set(snapshot.rooms);
      this.settingFields = snapshot.settings.length === 0
        ? []
        : SETTING_RULES.flatMap(rule => {
          const setting = snapshot.settings.find(item => item.key === rule.key);
          return setting ? [{ rule, setting }] : [];
        });
      this.savedSettings = new Map(this.settingFields.map(field => [field.setting.key, field.setting.value]));
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo cargar la configuración del cine.'));
    } finally {
      this.loading.set(false);
    }
  }

  seatTypeLabel(seatType: SeatType): string {
    return SEAT_TYPE_LABELS[seatType];
  }

  async savePricing(): Promise<void> {
    if (this.saving()) return;
    this.clearMessages();
    for (const row of this.pricing) {
      const error = validatePrice(row.basePrice) ?? validatePrice(row.presalePrice);
      if (error) {
        this.errorMessage.set(`${this.seatTypeLabel(row.seatType)}: ${error}`);
        return;
      }
    }

    this.saving.set('pricing');
    try {
      await this.configService.savePricing(this.pricing);
      this.successMessage.set('Precios guardados. Se aplicarán a las próximas compras.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudieron guardar los precios.'));
    } finally {
      this.saving.set('');
    }
  }

  editFormat(format: CinemaFormat): void {
    this.editingFormatId = format.id;
    this.formatForm = {
      name: format.name,
      priceMultiplier: format.priceMultiplier,
      active: format.active,
    };
    this.clearMessages();
  }

  resetFormatForm(): void {
    this.editingFormatId = null;
    this.formatForm = emptyFormat();
  }

  async saveFormat(): Promise<void> {
    if (this.saving()) return;
    this.clearMessages();
    const error = validateFormatName(this.formatForm.name) ?? validateFormatMultiplier(this.formatForm.priceMultiplier);
    if (error) {
      this.errorMessage.set(error);
      return;
    }

    this.saving.set('format');
    try {
      const saved = await this.configService.saveFormat({
        name: this.formatForm.name.trim(),
        priceMultiplier: Number(this.formatForm.priceMultiplier),
        active: this.formatForm.active,
      }, this.editingFormatId ?? undefined);
      this.formats.update(items => {
        const updated = this.editingFormatId === null
          ? [...items, saved]
          : items.map(item => item.id === saved.id ? saved : item);
        return updated.sort((a, b) => a.name.localeCompare(b.name, 'es'));
      });
      this.resetFormatForm();
      this.successMessage.set('Formato guardado.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo guardar el formato.'));
    } finally {
      this.saving.set('');
    }
  }

  async toggleFormat(format: CinemaFormat): Promise<void> {
    if (this.saving()) return;
    this.clearMessages();
    this.saving.set('format');
    try {
      const updated = await this.configService.saveFormat({
        name: format.name,
        priceMultiplier: format.priceMultiplier,
        active: !format.active,
      }, format.id);
      this.formats.update(items => items.map(item => item.id === updated.id ? updated : item));
      if (this.editingFormatId === updated.id) {
        this.formatForm = { ...this.formatForm, active: updated.active };
      }
      this.successMessage.set(updated.active ? 'Formato activado.' : 'Formato desactivado.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo cambiar el estado del formato.'));
    } finally {
      this.saving.set('');
    }
  }

  async createRoom(): Promise<void> {
    if (this.saving()) return;
    this.clearMessages();
    const error = validateRoomCode(this.roomCode);
    if (error) {
      this.errorMessage.set(error);
      return;
    }
    const code = normalizeRoomCode(this.roomCode);
    if (this.rooms().some(room => room.code === code)) {
      this.errorMessage.set(`La sala ${code} ya existe.`);
      return;
    }

    this.saving.set('room');
    try {
      const created = await this.configService.createRoom(code);
      this.rooms.update(items => [...items, created].sort((a, b) => a.code.localeCompare(b.code, 'es')));
      this.roomCode = '';
      this.successMessage.set(`Sala ${created.code} agregada.`);
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo agregar la sala.'));
    } finally {
      this.saving.set('');
    }
  }

  async toggleRoom(room: CinemaRoom): Promise<void> {
    if (this.saving()) return;
    this.clearMessages();
    this.saving.set('room');
    try {
      const updated = await this.configService.setRoomActive(room.code, !room.active);
      this.rooms.update(items => items.map(item => item.code === updated.code ? updated : item));
      this.successMessage.set(updated.active ? `Sala ${updated.code} activada.` : `Sala ${updated.code} desactivada.`);
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo cambiar el estado de la sala.'));
    } finally {
      this.saving.set('');
    }
  }

  async saveSettings(): Promise<void> {
    if (this.saving()) return;
    this.clearMessages();
    const invalid = this.settingFields
      .map(field => ({ field, error: validateIntegerSetting(field.rule, field.setting.value) }))
      .find(item => item.error !== null);
    if (invalid?.error) {
      this.errorMessage.set(invalid.error);
      return;
    }

    const changed = this.settingFields.filter(field =>
      field.setting.value.trim() !== (this.savedSettings.get(field.setting.key) ?? ''),
    );
    if (changed.length === 0) {
      this.successMessage.set('No hay cambios para guardar.');
      return;
    }

    this.saving.set('settings');
    try {
      for (const field of changed) {
        const saved = await this.configService.saveSetting(field.setting.key, field.setting.value);
        field.setting.value = saved.value;
        this.savedSettings.set(saved.key, saved.value);
      }
      this.successMessage.set('Parámetros guardados.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudieron guardar los parámetros.'));
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
