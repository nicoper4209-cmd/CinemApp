import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Movie } from '../../../models/movie';
import { AdminMovieInput, MovieService } from '../../../services/movie';

function emptyForm(): AdminMovieInput {
  return {
    title: '', synopsis: '', duration: 90, genre: '', age_rating: 'ATP',
    poster: '', alt: '', year: new Date().getFullYear(), rating: null,
    trailer: '', status: 'available', release_date: new Date().toISOString().slice(0, 10),
    is_featured: false, poster_horizontal: null,
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  movies = signal<Movie[]>([]);
  searchTerm = signal('');
  statusFilter = signal<'all' | 'featured' | Movie['status']>('all');
  visibleMovies = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase('es');
    const status = this.statusFilter();
    return this.movies().filter(movie =>
      (!query || movie.title.toLocaleLowerCase('es').includes(query)) &&
      (status === 'all' || (status === 'featured' ? movie.isFeatured === true : movie.status === status))
    );
  });
  loading = signal(true);
  saving = signal(false);
  updatingFeaturedId = signal<number | null>(null);
  editorOpen = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  editingId = signal<number | null>(null);
  isEditScreen = signal(false);
  form = emptyForm();
  posterFile: File | null = null;
  posterHorizontalFile: File | null = null;
  posterUrlInput = '';
  posterHorizontalUrlInput = '';
  posterPreview = '';
  posterHorizontalPreview = '';
  private savedPosterPreview = '';
  private savedPosterHorizontalPreview = '';
  private previewObjectUrls: string[] = [];

  constructor() {
    const routeId = this.route.snapshot.paramMap.get('id');
    if (routeId !== null && Number.isInteger(Number(routeId)) && Number(routeId) > 0) {
      this.isEditScreen.set(true);
      void this.loadMovieForEdit(Number(routeId));
    } else {
      this.loading.set(false);
      if (this.route.snapshot.queryParamMap.get('updated') === '1') {
        this.successMessage.set('Película actualizada.');
      }
      void this.loadMovies();
    }
  }

  private async loadMovieForEdit(id: number): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const movie = await this.movieService.getById(id);
      if (!movie) {
        this.errorMessage.set('No se encontró la película que querés editar.');
        return;
      }
      this.populateEditForm(movie);
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo cargar la película.'));
    } finally {
      this.loading.set(false);
    }
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
    this.posterHorizontalFile = null;
    this.posterUrlInput = '';
    this.posterHorizontalUrlInput = '';
    this.posterPreview = '';
    this.posterHorizontalPreview = '';
    this.savedPosterPreview = '';
    this.savedPosterHorizontalPreview = '';
    this.editingId.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.editorOpen.set(true);
  }

  editMovie(movie: Movie): void {
    void this.router.navigate(['/admin/movies', movie.id, 'edit']);
  }

  private populateEditForm(movie: Movie): void {
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
      poster_horizontal: movie.posterHorizontalPath ?? '',
    };
    this.posterFile = null;
    this.posterHorizontalFile = null;
    this.posterUrlInput = this.isExternalImageUrl(movie.posterPath) ? movie.posterPath! : '';
    this.posterHorizontalUrlInput = this.isExternalImageUrl(movie.posterHorizontalPath)
      ? movie.posterHorizontalPath!
      : '';
    this.savedPosterPreview = movie.poster;
    this.posterPreview = movie.poster;
    this.savedPosterHorizontalPreview = movie.posterHorizontal ?? '';
    this.posterHorizontalPreview = this.savedPosterHorizontalPreview;
    this.editingId.set(movie.id);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.editorOpen.set(true);
  }

  selectPoster(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.releasePreview(this.posterPreview);
    this.posterFile = file;
    if (file) this.posterUrlInput = '';
    this.posterPreview = file ? URL.createObjectURL(file) : this.savedPosterPreview;
    if (file) this.previewObjectUrls.push(this.posterPreview);
  }

  setPosterUrl(value: string, fileInput: HTMLInputElement): void {
    this.posterUrlInput = value;
    if (value.trim()) {
      this.posterFile = null;
      fileInput.value = '';
    }
  }

  selectHorizontalPoster(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.releasePreview(this.posterHorizontalPreview);
    this.posterHorizontalFile = file;
    if (file) this.posterHorizontalUrlInput = '';
    this.posterHorizontalPreview = file ? URL.createObjectURL(file) : this.savedPosterHorizontalPreview;
    if (file) this.previewObjectUrls.push(this.posterHorizontalPreview);
  }

  setPosterHorizontalUrl(value: string, fileInput: HTMLInputElement): void {
    this.posterHorizontalUrlInput = value;
    if (value.trim()) {
      this.posterHorizontalFile = null;
      fileInput.value = '';
    }
  }

  async saveMovie(): Promise<void> {
    if (this.saving()) return;
    this.errorMessage.set('');
    this.successMessage.set('');
    if (this.editingId() === null && !this.posterFile && !this.posterUrlInput.trim()) {
      this.errorMessage.set('Seleccioná un archivo o ingresá el enlace del póster vertical.');
      return;
    }

    this.saving.set(true);
    try {
      const id = this.editingId();
      const saved = await this.movieService.saveAdminMovie(
        { ...this.form, title: this.form.title.trim(), genre: this.form.genre.trim(), alt: this.form.alt.trim() },
        id ?? undefined,
        this.posterFile ?? undefined,
        this.posterHorizontalFile ?? undefined,
        this.posterUrlInput,
        this.posterHorizontalUrlInput,
      );
      this.movies.update(current => id === null
        ? [...current, saved].sort((a, b) => a.title.localeCompare(b.title, 'es'))
        : current.map(movie => movie.id === id ? saved : movie));
      if (this.isEditScreen()) {
        await this.router.navigate(['/admin/movies'], {
          queryParams: { updated: '1' },
        });
      } else {
        this.closeEditor();
        this.successMessage.set('Película creada.');
      }
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

  async setFeatured(movie: Movie, isFeatured: boolean): Promise<void> {
    if (this.updatingFeaturedId() !== null) return;
    if (movie.isFeatured === isFeatured) return;
    this.errorMessage.set('');
    this.successMessage.set('');
    this.updatingFeaturedId.set(movie.id);
    try {
      const updated = await this.movieService.setFeatured(movie.id, isFeatured);
      this.movies.update(current => current.map(item => item.id === updated.id ? updated : item));
      this.successMessage.set(updated.isFeatured
        ? `“${updated.title}” ahora está destacada.`
        : `Se quitó “${updated.title}” de destacadas.`);
    } catch (error) {
      this.errorMessage.set(this.message(error, 'No se pudo cambiar el estado destacado.'));
    } finally {
      this.updatingFeaturedId.set(null);
    }
  }

  closeEditor(): void {
    this.editorOpen.set(false);
    this.posterFile = null;
    this.posterHorizontalFile = null;
    this.posterUrlInput = '';
    this.posterHorizontalUrlInput = '';
    this.clearPreview();
    this.posterPreview = '';
    this.posterHorizontalPreview = '';
    this.savedPosterPreview = '';
    this.savedPosterHorizontalPreview = '';
  }

  cancelEditor(): void {
    if (this.isEditScreen()) {
      this.clearPreview();
      void this.router.navigate(['/admin/movies']);
      return;
    }
    this.closeEditor();
  }

  statusLabel(status: Movie['status']): string {
    if (status === 'upcoming') return 'Próximamente';
    if (status === 'unavailable') return 'No disponible';
    return 'En cartelera';
  }

  get searchTermValue(): string { return this.searchTerm(); }
  set searchTermValue(value: string) { this.searchTerm.set(value); }
  get statusFilterValue(): 'all' | 'featured' | Movie['status'] { return this.statusFilter(); }
  set statusFilterValue(value: 'all' | 'featured' | Movie['status']) { this.statusFilter.set(value); }

  private clearPreview(): void {
    for (const url of this.previewObjectUrls) URL.revokeObjectURL(url);
    this.previewObjectUrls = [];
  }

  private releasePreview(url: string): void {
    if (!url.startsWith('blob:')) return;
    URL.revokeObjectURL(url);
    this.previewObjectUrls = this.previewObjectUrls.filter(item => item !== url);
  }

  private message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  private isExternalImageUrl(path?: string | null): boolean {
    return !!path && /^https?:\/\//i.test(path);
  }
}
