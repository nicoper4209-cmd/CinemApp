
import { Injectable, signal } from '@angular/core';
import { AuthService } from './auth';
import { supabase } from '../supabase.client';

@Injectable({
  providedIn: 'root',
})
export class FavoriteService {
  favoriteIds = signal<number[]>([]);
  loading = signal(false);

  constructor(private authService: AuthService) {}

  async loadFavorites(): Promise<void> {
    const user = this.authService.user();

    if (!user) {
      this.favoriteIds.set([]);
      return;
    }

    this.loading.set(true);

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('movie_id')
        .eq('user_id', user.id);

      if (error) throw error;

      this.favoriteIds.set(
        (data ?? []).map((favorite) => favorite.movie_id)
      );
    } catch (error) {
      console.error('Error al cargar favoritos:', error);
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  isFavorite(id: number): boolean {
    return this.favoriteIds().includes(id);
  }

  async toggleFavorite(id: number): Promise<void> {
    const user = this.authService.user();

    if (!user) {
      throw new Error('Tenés que iniciar sesión para gestionar favoritos.');
    }

    const isCurrentlyFavorite = this.isFavorite(id);

    if (isCurrentlyFavorite) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('movie_id', id);

      if (error) throw error;

      this.favoriteIds.update(ids => ids.filter(favoriteId => favoriteId !== id));
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({
          user_id: user.id,
          movie_id: id,
        });

      if (error) throw error;

      this.favoriteIds.update(ids =>
        ids.includes(id) ? ids : [...ids, id]
      );
    }
  }
}
