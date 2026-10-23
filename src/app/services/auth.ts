
import { Injectable, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { supabase } from '../supabase.client';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  user = signal<User | null>(null);
  initialized = signal(false);

  constructor() {
    supabase.auth.onAuthStateChange((_event, session) => {
      this.user.set(session?.user ?? null);
      this.initialized.set(true);
    });
  }

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
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
