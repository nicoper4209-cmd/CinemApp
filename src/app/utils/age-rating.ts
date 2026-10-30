/** Advisory display helper; Supabase remains authoritative for purchase eligibility. */
export function requiresAccompanyingAdult(ageRating: string | null | undefined): boolean {
  return ageRating === '+13' || ageRating === '+18';
}
