export interface Movie {
  id: number;
  title: string;
  synopsis: string;
  duration: number;
  genre: string;
  ageRating: string;
  poster: string;
  alt: string;
  year: string;
  rating: number;
  trailer: string
  status: 'available' | 'upcoming' | 'unavailable';
  releaseDate?: string | null;
  isFeatured?: boolean;
  /** Path in the posters Storage bucket; `poster` is its display URL. */
  posterPath?: string;
  /** Optional horizontal poster URL and underlying Storage path. */
  posterHorizontal?: string | null;
  posterHorizontalPath?: string | null;
}
