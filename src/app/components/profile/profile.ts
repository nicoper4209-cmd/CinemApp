import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, AppRole } from '../../services/auth';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  auth = inject(AuthService);
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
      if (birthDate && new Date(`${birthDate}T00:00:00`) > new Date()) {
        throw new Error('La fecha de nacimiento no puede estar en el futuro.');
      }
      await this.auth.updateProfile({ full_name: name, birth_date: birthDate });
      this.successMessage.set('Perfil actualizado.');
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
}
