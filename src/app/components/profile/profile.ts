import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, AppRole } from '../../services/auth';
import { NotificationSettings } from '../notification-settings/notification-settings';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, NotificationSettings],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  birthDateRequired = this.route.snapshot.queryParamMap.get('completeBirthDate') === '1';
  fullName = signal('');
  birthDate = signal('');
  loading = signal(false);
  saving = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  private readonly today = new Date();
  maxBirthDate = [
    this.today.getFullYear(),
    String(this.today.getMonth() + 1).padStart(2, '0'),
    String(this.today.getDate()).padStart(2, '0'),
  ].join('-');

  constructor() {
    void this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const profile = await this.auth.loadProfile();
      if (!profile) throw new Error('No se pudo verificar el perfil.');
      this.fullName.set(profile.full_name ?? '');
      this.birthDate.set(profile.birth_date ?? '');
      if (this.birthDateRequired && profile.birth_date) {
        await this.router.navigateByUrl(this.safeReturnUrl(), { state: history.state });
      }
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo cargar el perfil.');
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      const name = this.fullName().trim();
      const birthDate = this.birthDate() || null;
      if (!name) throw new Error('Ingresá tu nombre.');
      if (this.birthDateRequired && !birthDate) throw new Error('Ingresá tu fecha de nacimiento para continuar.');
      if (birthDate && (birthDate < '1900-01-01' || birthDate > this.maxBirthDate)) {
        throw new Error('Ingresá una fecha de nacimiento válida.');
      }
      if (birthDate && new Date(`${birthDate}T00:00:00`) > new Date()) {
        throw new Error('La fecha de nacimiento no puede estar en el futuro.');
      }
      await this.auth.updateProfile({ full_name: name, birth_date: birthDate });
      this.successMessage.set('Perfil actualizado.');
      if (this.birthDateRequired) {
        await this.router.navigateByUrl(this.safeReturnUrl(), { state: history.state });
      }
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo guardar el perfil.');
    } finally {
      this.saving.set(false);
    }
  }

  roleLabel(role: AppRole | undefined): string {
    switch (role) {
      case 'cliente': return 'Cliente';
      case 'empleado': return 'Empleado';
      case 'admin': return 'Administrador';
      default: return 'Verificando…';
    }
  }

  get fullNameValue(): string { return this.fullName(); }
  set fullNameValue(value: string) { this.fullName.set(value); }
  get birthDateValue(): string { return this.birthDate(); }
  set birthDateValue(value: string) { this.birthDate.set(value); }

  private safeReturnUrl(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (!returnUrl) return '/';
    try {
      const target = new URL(returnUrl, window.location.origin);
      if (target.origin !== window.location.origin) return '/';
      return `${target.pathname}${target.search}${target.hash}`;
    } catch {
      return '/';
    }
  }
}
