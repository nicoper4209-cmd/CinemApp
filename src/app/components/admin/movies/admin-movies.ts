import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Movie } from '../../../models/movie';
import { AdminMovieInput, MovieService } from '../../../services/movie';

function emptyForm(): AdminMovieInput {
  return {
    title: '', synopsis: '', duration: 90, genre: '', age_rating: 'ATP',
    poster: '', alt: '', year: new Date().getFullYear(), rating: null,
    trailer: '', status: 'available', release_date: new Date().toISOString().slice(0, 10),
    is_featured: false,
  };
}

@Component({
  selector: 'app-admin-movies',
  imports: [FormsModule],
  templateUrl: './admin-movies.html',
  styleUrl: './admin-movies.css',
})
export class AdminMovies {
  private movieService = inject(MovieService);
  movies = signal<Movie[]>([]);
  searchTerm = signal('');
  statusFilter = signal<'all' | Movie['status']>('all');
  visibleMovies = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase('es');
    const status = this.statusFilter();
    return this.movies().filter(movie =>
      (!query || movie.title.toLocaleLowerCase('es').includes(query)) &&
      (status === 'all' || movie.status === status)
    );
  });
  loading = signal(true);
  saving = signal(false);
  editorOpen = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  editingId = signal<number | null>(null);
  form = emptyForm();
  posterFile: File | null = null;
  posterPreview = '';
  private savedPosterPreview = '';
  private previewObjectUrl: string | null = null;

  constructor() {
    void this.loadMovies();
  }

  async loadMovies(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.movies.set(await this.movieService.getAll());
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudieron cargar las películas.'));
    } finally {
      this.loading.set(false);
    }
  }

  createMovie(): void {
    this.clearPreview();
    this.form = emptyForm();
    this.posterFile = null;
    this.posterPreview = '';
    this.savedPosterPreview = '';
    this.editingId.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.editorOpen.set(true);
  }

  editMovie(movie: Movie): void {
    this.clearPreview();
    this.form = {
      title: movie.title,
      synopsis: movie.synopsis,
      duration: movie.duration,
      genre: movie.genre,
      age_rating: movie.ageRating,
      poster: movie.posterPath ?? movie.poster,
      alt: movie.alt,
      year: Number(movie.year),
      rating: movie.rating,
      trailer: movie.trailer,
      status: movie.status,
      release_date: movie.releaseDate ?? '',
      is_featured: movie.isFeatured ?? false,
    };
    this.posterFile = null;
    this.savedPosterPreview = movie.poster;
    this.posterPreview = movie.poster;
    this.editingId.set(movie.id);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.editorOpen.set(true);
  }

  selectPoster(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.clearPreview();
    this.posterFile = file;
    this.posterPreview = file ? URL.createObjectURL(file) : this.savedPosterPreview;
    if (file) this.previewObjectUrl = this.posterPreview;
  }

  async saveMovie(): Promise<void> {
    if (this.saving()) return;
    this.errorMessage.set('');
    this.successMessage.set('');
    if (this.editingId() === null && !this.posterFile) {
      this.errorMessage.set('Seleccioná un póster para la película.');
      return;
    }

    this.saving.set(true);
    try {
      const id = this.editingId();
      const saved = await this.movieService.saveAdminMovie(
        { ...this.form, title: this.form.title.trim(), genre: this.form.genre.trim(), alt: this.form.alt.trim() },
        id ?? undefined,
        this.posterFile ?? undefined,
      );
      this.movies.update(current => id === null
        ? [...current, saved].sort((a, b) => a.title.localeCompare(b.title, 'es'))
        : current.map(movie => movie.id === id ? saved : movie));
      this.closeEditor();
      this.successMessage.set(id === null ? 'Película creada.' : 'Película actualizada.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo guardar la película.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteMovie(movie: Movie): Promise<void> {
    if (!window.confirm(`¿Eliminar “${movie.title}”? Esta acción no se puede deshacer.`)) return;
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      await this.movieService.deleteAdminMovie(movie.id);
      this.movies.update(current => current.filter(item => item.id !== movie.id));
      this.successMessage.set('Película eliminada.');
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo eliminar la película.'));
    }
  }

  closeEditor(): void {
    this.editorOpen.set(false);
    this.posterFile = null;
    this.clearPreview();
    this.posterPreview = '';
    this.savedPosterPreview = '';
  }

  statusLabel(status: Movie['status']): string {
    if (status === 'upcoming') return 'Próximamente';
    if (status === 'unavailable') return 'No disponible';
    return 'En cartelera';
  }

  get searchTermValue(): string { return this.searchTerm(); }
  set searchTermValue(value: string) { this.searchTerm.set(value); }
  get statusFilterValue(): 'all' | Movie['status'] { return this.statusFilter(); }
  set statusFilterValue(value: 'all' | Movie['status']) { this.statusFilter.set(value); }

  private clearPreview(): void {
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
    this.previewObjectUrl = null;
  }

  private message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
