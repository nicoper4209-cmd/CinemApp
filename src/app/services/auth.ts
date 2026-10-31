
import { Injectable, signal } from '@angular/core';
import { AuthChangeEvent, User } from '@supabase/supabase-js';
import { supabase } from '../supabase.client';

export type AppRole = 'cliente' | 'empleado' | 'admin';

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  birth_date: string | null;
  avatar_url: string | null;
  role: AppRole;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  user = signal<User | null>(null);
  profile = signal<UserProfile | null>(null);
  initialized = signal(false);
  profileError = signal('');
  private profileRequest = 0;

  constructor() {
    supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session) => {
      const request = ++this.profileRequest;
      this.user.set(session?.user ?? null);
      this.profile.set(null);
      this.profileError.set('');
      if (!session || session.user.is_anonymous) {
        this.initialized.set(true);
        return;
      }
      this.initialized.set(false);
      // Do not await profile I/O inside Supabase's auth event callback.
      void this.loadProfile(session.user.id)
        .catch(() => undefined)
        .finally(() => {
          if (request === this.profileRequest && this.user()?.id === session.user.id) {
            this.initialized.set(true);
          }
        });
    });
  }

  async loadProfile(userId?: string): Promise<UserProfile | null> {
    let targetUserId = userId ?? this.user()?.id;
    if (!targetUserId) {
      const session = await this.getSession();
      if (!session || session.user.is_anonymous) return null;
      this.user.set(session.user);
      targetUserId = session.user.id;
    }
    if (!targetUserId) {
      this.profile.set(null);
      return null;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,birth_date,avatar_url,role')
      .eq('id', targetUserId)
      .maybeSingle();
    if (error) {
      this.profileError.set(error.message);
      throw new Error(error.message);
    }
    if (!data) {
      const message = 'No se encontró el perfil de esta cuenta.';
      this.profileError.set(message);
      throw new Error(message);
    }
    const profile = data as UserProfile;
    if (this.user()?.id === targetUserId) {
      this.profile.set(profile);
      this.profileError.set('');
    }
    return profile;
  }

  async updateProfile(updates: Pick<UserProfile, 'full_name' | 'birth_date'>): Promise<UserProfile> {
    const userId = this.user()?.id;
    if (!userId || this.user()?.is_anonymous) throw new Error('Iniciá sesión con una cuenta registrada.');

    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: updates.full_name, birth_date: updates.birth_date })
      .eq('id', userId)
      .select('id,email,full_name,birth_date,avatar_url,role')
      .single();
    if (error) throw new Error(error.message);
    const profile = data as UserProfile;
    this.profile.set(profile);
    return profile;
  }

  async signUp(email: string, password: string, birthDate: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { birth_date: birthDate } },
    });

    if (error) throw error;

    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return data;
  }

  async signInWithProvider(provider: 'google' | 'github', redirectTo: string) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) throw error;
    return data;
  }

  async continueAsGuest() {
    const session = await this.getSession();
    if (session) return session;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.session;
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;
  }

  async getSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    return data.session;
  }
}
