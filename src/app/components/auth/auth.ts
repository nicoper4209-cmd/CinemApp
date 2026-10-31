import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-auth',
  imports: [FormsModule, RouterLink],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = signal('');
  password = signal('');
  birthDate = signal('');
  guestEmail = signal('');
  guestBirthDate = signal('');
  guestFormVisible = signal(false);
  maxBirthDate = new Date().toISOString().slice(0, 10);
  isRegistering = signal(false);
  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  constructor() {
    this.isRegistering.set(this.router.url.split('?')[0] === '/register');
  }

  
  async submit(): Promise<void> {
    if (this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      if (this.isRegistering()) {
        await this.authService.signUp(
          this.email().trim(),
          this.password(),
          this.birthDate()
        );

        this.successMessage.set('Cuenta creada correctamente.');
      } else {
        await this.authService.signIn(
          this.email().trim(),
          this.password()
        );

        const profile = await this.authService.loadProfile();
        if (profile && !profile.birth_date) {
          await this.router.navigate(['/profile'], {
            queryParams: { completeBirthDate: '1', returnUrl: this.safeReturnUrl() },
          });
        } else {
          await this.router.navigateByUrl(this.safeReturnUrl());
        }
      }
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'Ocurrió un error. Intentá nuevamente.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  async signInWithProvider(provider: 'google' | 'github'): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      const redirectTo = `${window.location.origin}/auth/callback?returnUrl=${encodeURIComponent(this.safeReturnUrl())}`;
      await this.authService.signInWithProvider(provider, redirectTo);
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'No se pudo iniciar sesión con el proveedor.'
      );
      this.loading.set(false);
    }
  }

  async continueAsGuest(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await this.authService.continueAsGuest();
      await this.router.navigateByUrl(this.safeReturnUrl(), {
        state: {
          ...history.state,
          guestEmail: this.guestEmail().trim(),
          guestBirthDate: this.guestBirthDate(),
        },
      });
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo iniciar la sesión de visitante.');
    } finally {
      this.loading.set(false);
    }
  }

  private safeReturnUrl(): string {
    const returnUrl = this.router.parseUrl(this.router.url).queryParams['returnUrl'];
    if (typeof returnUrl !== 'string') return '/';
    try {
      const target = new URL(returnUrl, window.location.origin);
      if (target.origin !== window.location.origin) return '/';
      return `${target.pathname}${target.search}${target.hash}`;
    } catch {
      return '/';
    }
  }


  toggleMode(): void {
    this.isRegistering.update(value => !value);
    this.errorMessage.set('');
    this.successMessage.set('');
  }


  get emailValue(): string {
    return this.email();
  }

  set emailValue(value: string) {
    this.email.set(value);
  }

  get passwordValue(): string {
    return this.password();
  }

  set passwordValue(value: string) {
    this.password.set(value);
  }

  get birthDateValue(): string { return this.birthDate(); }
  set birthDateValue(value: string) { this.birthDate.set(value); }
  get guestEmailValue(): string { return this.guestEmail(); }
  set guestEmailValue(value: string) { this.guestEmail.set(value); }
  get guestBirthDateValue(): string { return this.guestBirthDate(); }
  set guestBirthDateValue(value: string) { this.guestBirthDate.set(value); }

}
