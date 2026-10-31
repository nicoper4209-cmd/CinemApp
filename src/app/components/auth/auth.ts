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
          this.password()
        );

        this.successMessage.set(
          'Cuenta creada. Si te solicitaron confirmar tu correo, revisá tu bandeja de entrada.'
        );
      } else {
        await this.authService.signIn(
          this.email().trim(),
          this.password()
        );

        await this.router.navigateByUrl(this.safeReturnUrl());
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

}
