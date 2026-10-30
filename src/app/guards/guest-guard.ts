import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const guestGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    const session = await authService.getSession();

    if (session && !session.user.is_anonymous) {
      return router.createUrlTree(['/']);
    }

    return true;
  } catch {
    return router.createUrlTree(['/']);
  }
};
