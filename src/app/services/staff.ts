import { Injectable } from '@angular/core';
import { supabase } from '../supabase.client';

export interface TicketValidationResult {
  ok: true;
  movie: string;
  room: string;
  starts_at: string;
  seat: string;
  seat_type: 'standard' | 'accessible' | 'vip' | string;
  age_rating: 'ATP' | '+13' | '+18' | string;
  minor_notice: boolean;
}

export interface CandyDeliveryResult {
  ok: true;
  items: Array<{ name: string; qty: number }>;
}

@Injectable({ providedIn: 'root' })
export class StaffService {
  async validateTicket(code: string): Promise<TicketValidationResult> {
    const { data, error } = await supabase.rpc('validate_ticket', { p_code: code.trim() });
    if (error) throw new Error(error.message);
    const result = data as TicketValidationResult | null;
    if (!result?.ok) throw new Error('La validación no devolvió una confirmación válida.');
    return result;
  }

  async deliverCandy(code: string): Promise<CandyDeliveryResult> {
    const { data, error } = await supabase.rpc('deliver_candy', { p_code: code.trim() });
    if (error) throw new Error(error.message);
    const result = data as CandyDeliveryResult | null;
    if (!result?.ok || !Array.isArray(result.items)) {
      throw new Error('La entrega no devolvió un pedido válido.');
    }
    return result;
  }
}
