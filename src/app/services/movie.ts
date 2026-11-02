
import { Injectable } from '@angular/core';
import { Movie } from '../models/movie';
import { supabase } from '../supabase.client';

interface MovieRow {
  id: number;
  title: string;
  synopsis: string;
  duration: number;
  genre: string;
  age_rating: string;
  poster: string;
  poster_horizontal: string | null;
  alt: string;
  year: number;
  rating: number | null;
  trailer: string;
  status: Movie['status'];
  release_date: string | null;
  is_featured: boolean;
}

export interface AdminMovieInput {
  title: string;
  synopsis: string;
  duration: number;
  genre: string;
  age_rating: string;
  poster: string;
  alt: string;
  year: number;
  rating: number | null;
  trailer: string;
  status: Movie['status'];
  release_date: string;
  is_featured: boolean;
  poster_horizontal: string | null;
}

export interface TopMovie {
  movieId: number;
  title: string;
  poster: string;
  ticketsSold: number;
}

const MOVIE_COLUMNS =
  'id, title, synopsis, duration, genre, age_rating, poster, poster_horizontal, alt, year, rating, trailer, status, release_date, is_featured';

@Injectable({
  providedIn: 'root',
})
export class MovieService {
  async getAll(): Promise<Movie[]> {
    const { data, error } = await supabase
      .from('movies')
      .select(MOVIE_COLUMNS)
      .order('id', { ascending: true });

    if (error) {
      console.error('Error al cargar películas:', error);
      throw error;
    }

    return (data ?? []).map((row) => this.mapMovie(row as MovieRow));
  }

  async getById(id: number): Promise<Movie | undefined> {
    const { data, error } = await supabase
      .from('movies')
      .select(MOVIE_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error al cargar película:', error);
      throw error;
    }

    return data
      ? this.mapMovie(data as MovieRow)
      : undefined;
  }

  async getAvailable(): Promise<Movie[]> {
    const movies = await this.getAll();
    return movies.filter(movie => movie.status === 'available');
  }

  async getFeatured(): Promise<Movie[]> {
    const movies = await this.getAvailable();
    return movies.filter(movie => movie.isFeatured === true);
  }

  async getTopMovies(): Promise<TopMovie[]> {
    const { data, error } = await supabase
      .from('top_movies_30d')
      .select('movie_id,title,poster,tickets_sold')
      .order('tickets_sold', { ascending: false })
      .limit(3);

    if (error) {
      console.error('Error al cargar el Top 3:', error);
      throw error;
    }

    return (data ?? []).map(row => {
      const movie = row as { movie_id: number; title: string; poster: string; tickets_sold: number };
      return {
        movieId: movie.movie_id,
        title: movie.title,
        poster: this.posterUrl(movie.poster),
        ticketsSold: Number(movie.tickets_sold),
      };
    });
  }

  async setFeatured(id: number, isFeatured: boolean): Promise<Movie> {
    const { data, error } = await supabase
      .from('movies')
      .update({ is_featured: isFeatured })
      .eq('id', id)
      .select(MOVIE_COLUMNS)
      .single();

    if (error) throw new Error(error.message);
    return this.mapMovie(data as MovieRow);
  }

  async getUpcoming(): Promise<Movie[]> {
    const movies = await this.getAll();
    return movies.filter(movie => movie.status === 'upcoming');
  }

  async saveAdminMovie(
    input: AdminMovieInput,
    id?: number,
    posterFile?: File,
    posterHorizontalFile?: File,
    posterUrl?: string,
    posterHorizontalUrl?: string,
  ): Promise<Movie> {
    let posterPath = posterUrl?.trim() || input.poster.trim();
    let posterHorizontalPath = posterHorizontalUrl?.trim() || input.poster_horizontal?.trim() || null;
    let uploadedPosterPath: string | null = null;
    let uploadedHorizontalPath: string | null = null;

    if (posterFile) {
      uploadedPosterPath = await this.uploadPoster(posterFile);
      posterPath = uploadedPosterPath;
    }

    if (posterHorizontalFile) {
      try {
        uploadedHorizontalPath = await this.uploadPoster(posterHorizontalFile);
      } catch (error) {
        if (uploadedPosterPath) await this.removePoster(uploadedPosterPath);
        throw error;
      }
      posterHorizontalPath = uploadedHorizontalPath;
    }

    const values = { ...input, poster: posterPath, poster_horizontal: posterHorizontalPath };
    const query = id === undefined
      ? supabase.from('movies').insert(values)
      : supabase.from('movies').update(values).eq('id', id);
    const { data, error } = await query.select(MOVIE_COLUMNS).single();

    if (error) {
      if (uploadedPosterPath) await this.removePoster(uploadedPosterPath);
      if (uploadedHorizontalPath) await this.removePoster(uploadedHorizontalPath);
      throw new Error(error.message);
    }

    if (input.poster && input.poster !== posterPath) {
      await this.removePoster(input.poster);
    }
    if (input.poster_horizontal && input.poster_horizontal !== posterHorizontalPath) {
      await this.removePoster(input.poster_horizontal);
    }

    return this.mapMovie(data as MovieRow);
  }

  private async uploadPoster(file: File): Promise<string> {
    const extension = this.posterExtension(file);
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('posters').upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return path;
  }

  async deleteAdminMovie(id: number): Promise<void> {
    const { data, error } = await supabase
      .from('movies')
      .delete()
      .eq('id', id)
      .select('poster,poster_horizontal')
      .single();
    if (error) throw new Error(error.message);

    const poster = data?.['poster'];
    if (typeof poster === 'string') await this.removePoster(poster);
    const horizontalPoster = data?.['poster_horizontal'];
    if (typeof horizontalPoster === 'string') await this.removePoster(horizontalPoster);
  }

  private posterExtension(file: File): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensions[file.type];
    if (!extension) throw new Error('El póster debe ser una imagen JPG, PNG o WebP.');
    return extension;
  }

  private async removePoster(path: string): Promise<void> {
    const storagePath = this.storagePath(path);
    if (!storagePath) return;
    const { error } = await supabase.storage.from('posters').remove([storagePath]);
    if (error) console.error('No se pudo quitar el archivo de póster:', error.message);
  }

  private storagePath(path: string): string | null {
    const marker = '/storage/v1/object/public/posters/';
    if (path.startsWith(marker)) return path.slice(marker.length);
    if (/^https?:\/\//i.test(path)) return null;
    return path;
  }

  private mapMovie(row: MovieRow): Movie {
    return {
      id: row.id,
      title: row.title,
      synopsis: row.synopsis,
      duration: row.duration,
      genre: row.genre,
      ageRating: row.age_rating,
      poster: this.posterUrl(row.poster),
      posterPath: row.poster,
      posterHorizontal: row.poster_horizontal ? this.posterUrl(row.poster_horizontal) : null,
      posterHorizontalPath: row.poster_horizontal,
      alt: row.alt,
      year: String(row.year),
      rating: row.rating ?? 0,
      trailer: row.trailer,
      status: row.status,
      releaseDate: row.release_date,
      isFeatured: row.is_featured,
    };
  }

  private posterUrl(path: string): string {
    if (!path || /^https?:\/\//i.test(path)) return path;
    return supabase.storage.from('posters').getPublicUrl(path).data.publicUrl;
  }
}
