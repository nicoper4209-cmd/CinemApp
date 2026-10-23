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

        await this.router.navigate(['/']);
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
