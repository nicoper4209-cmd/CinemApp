import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})

export class FavoriteService {
  private readonly storageKey = 'cinemapp-favorites';

  readonly favoriteIds = signal<number[]>(
    this.loadFavorites()
  );

  private loadFavorites(): number[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const saved = localStorage.getItem(this.storageKey);

    if (!saved) {
      return [];
    }

    try {
      return JSON.parse(saved) as number[];
    } catch {
      return [];
    }
  }

  isFavorite(id: number): boolean {
    return this.favoriteIds().includes(id);
  }

  toggleFavorite(id: number): void {
    const current = this.favoriteIds();

    const updated = current.includes(id)
      ? current.filter(favoriteId => favoriteId !== id)
      : [...current, id];

    this.favoriteIds.set(updated);

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(updated)
    );
  }
}