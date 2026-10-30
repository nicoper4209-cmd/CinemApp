
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
  alt: string;
  year: number;
  rating: number | null;
  trailer: string;
  status: Movie['status'];
  release_date: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class MovieService {
  async getAll(): Promise<Movie[]> {
    const { data, error } = await supabase
      .from('movies')
      .select(
        'id, title, synopsis, duration, genre, age_rating, poster, alt, year, rating, trailer, status, release_date'
      )
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
      .select(
        'id, title, synopsis, duration, genre, age_rating, poster, alt, year, rating, trailer, status, release_date'
      )
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

  async getUpcoming(): Promise<Movie[]> {
    const movies = await this.getAll();
    return movies.filter(movie => movie.status === 'upcoming');
  }

  private mapMovie(row: MovieRow): Movie {
    return {
      id: row.id,
      title: row.title,
      synopsis: row.synopsis,
      duration: row.duration,
      genre: row.genre,
      ageRating: row.age_rating,
      poster: row.poster,
      alt: row.alt,
      year: String(row.year),
      rating: row.rating ?? 0,
      trailer: row.trailer,
      status: row.status,
      releaseDate: row.release_date,
    };
  }
}
