import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppRole, AuthService } from '../services/auth';

function roleGuard(allowedRoles: AppRole[], returnUrl: string): CanActivateFn {
  return async (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    try {
      const session = await auth.getSession();
      if (!session || session.user.is_anonymous) {
        return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
      }
      const profile = await auth.loadProfile(session.user.id);
      if (profile && allowedRoles.includes(profile.role)) return true;
    } catch {
      // Fail closed when the session or authoritative profile cannot be verified.
    }
    return router.createUrlTree([returnUrl]);
  };
}

/** Exact customer role: employee/admin accounts are deliberately not treated as customers. */
export const customerGuard = roleGuard(['cliente'], '/');
/** Staff access includes administrators. */
export const staffGuard = roleGuard(['empleado', 'admin'], '/');
export const adminGuard = roleGuard(['admin'], '/');
