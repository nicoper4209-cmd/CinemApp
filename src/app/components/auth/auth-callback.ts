import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-auth-callback',
  imports: [RouterLink],
  template: `
    <main class="callback-page">
      <section class="callback-card">
        <p class="eyebrow">CINEMAPP / AUTENTICACIÓN</p>
        @if (errorMessage()) {
          <h1>No se pudo iniciar sesión</h1>
          <p class="error-message" role="alert">{{ errorMessage() }}</p>
          <a routerLink="/login">Volver a iniciar sesión</a>
        } @else {
          <h1>Verificando tu cuenta…</h1>
          <p role="status">Estamos completando el inicio de sesión de forma segura.</p>
        }
      </section>
    </main>
  `,
  styles: [`
    .callback-page { min-height: 65vh; display: grid; place-items: center; padding: 24px; background: #faf9f6; }
    .callback-card { width: min(100%, 440px); padding: 30px; border: 1px solid #dedbd5; background: white; }
    .eyebrow { color: #77736c; font-size: 11px; letter-spacing: .14em; }
    h1 { font-size: 26px; font-weight: 500; }
    p { color: #68655f; line-height: 1.6; }
    .error-message { color: #a3332f; }
    a { color: #242424; }
  `],
})
export class AuthCallback {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  errorMessage = signal('');

  constructor() {
    void this.completeSignIn();
  }

  private async completeSignIn(): Promise<void> {
    const providerError = this.readProviderError();
    if (providerError) {
      this.errorMessage.set(providerError);
      return;
    }

    try {
      const session = await this.auth.getSession();
      if (!session || session.user.is_anonymous) {
        throw new Error('No se recibió una sesión válida del proveedor.');
      }
      await this.auth.loadProfile(session.user.id);
      await this.router.navigateByUrl(this.safeReturnUrl());
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'No se pudo verificar la cuenta.'
      );
    }
  }

  private readProviderError(): string {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const description = hash.get('error_description') ?? hash.get('error');
    const query = new URLSearchParams(window.location.search);
    return description ?? query.get('error_description') ?? query.get('error') ?? '';
  }

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
