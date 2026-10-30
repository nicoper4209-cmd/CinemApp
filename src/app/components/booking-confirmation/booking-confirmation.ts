
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Booking, BookingCandyItem, BookingTicket } from '../../models/booking';
import { MovieService } from '../../services/movie';
import { ShowtimeService } from '../../services/showtime';
import { supabase } from '../../supabase.client';
import { requiresAccompanyingAdult } from '../../utils/age-rating';

@Component({
  selector: 'app-booking-confirmation',
  imports: [RouterLink],
  templateUrl: './booking-confirmation.html',
  styleUrl: './booking-confirmation.css',
})
export class BookingConfirmation {
  private route = inject(ActivatedRoute);
  private movieService = inject(MovieService);
  private showtimeService = inject(ShowtimeService);

  bookingId = this.route.snapshot.paramMap.get('id') ?? '';

  booking = signal<Booking | undefined>(undefined);
  loading = signal(true);
  errorMessage = signal('');
  qrError = signal('');
  pdfError = signal('');
  generatingPdf = signal(false);

  constructor() {
    void this.loadBooking();
  }

  private async loadBooking(): Promise<void> {
    try {
      const { data: row, error } = await supabase
        .from('bookings')
        .select('id, movie_id, showtime_id, total, created_at, contact_email, candy_qr, candy_code')
        .eq('id', this.bookingId)
        .single();

      if (error) {
        throw error;
      }

      const [movie, showtime] = await Promise.all([
        row.movie_id ? this.movieService.getById(row.movie_id) : Promise.resolve(undefined),
        row.showtime_id ? this.showtimeService.getById(row.showtime_id) : Promise.resolve(undefined),
      ]);

      if (row.showtime_id && (!movie || !showtime)) {
        throw new Error('No se encontraron los datos de la película o función.');
      }

      const { data: seatRows, error: seatsError } = await supabase
        .from('booking_seats')
        .select('seat_label,seat_type,price,qr_code,manual_code')
        .eq('booking_id', this.bookingId)
        .order('seat_label');

      if (seatsError) {
        throw seatsError;
      }

      const { data: candyRows, error: candyError } = await supabase
        .from('booking_candy_items')
        .select('product_id,quantity,unit_price,candy_products(name)')
        .eq('booking_id', this.bookingId);
      if (candyError) throw candyError;

      const tickets: BookingTicket[] = (seatRows ?? []).map(seat => ({
        seatLabel: seat.seat_label,
        seatType: seat.seat_type,
        price: Number(seat.price),
        qrCode: seat.qr_code,
        manualCode: seat.manual_code,
      }));
      const candyItems: BookingCandyItem[] = (candyRows ?? []).map(item => ({
        productId: item.product_id,
        name: item.candy_products?.[0]?.name ?? `Producto ${item.product_id}`,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
      }));

      this.booking.set({
        id: row.id,
        movie,
        showtime,
        seats: tickets.map(ticket => ticket.seatLabel),
        total: Number(row.total),
        createdAt: row.created_at,
        contactEmail: row.contact_email,
        tickets,
        candyItems,
        candyQr: row.candy_qr ?? undefined,
        candyCode: row.candy_code ?? undefined,
      });

      try {
        const QRCode = await import('qrcode');
        const [ticketsWithQr, candyQrDataUrl] = await Promise.all([
          Promise.all(tickets.map(async ticket => ({
          ...ticket,
          qrDataUrl: await QRCode.toDataURL(ticket.qrCode, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 220,
          }),
          }))),
          row.candy_qr
            ? QRCode.toDataURL(row.candy_qr, { errorCorrectionLevel: 'M', margin: 1, width: 220 })
            : Promise.resolve(undefined),
        ]);
        this.booking.update(purchase => purchase
          ? { ...purchase, tickets: ticketsWithQr, candyQrDataUrl }
          : purchase);
      } catch (error) {
        console.error('No se pudieron generar los QR de las entradas:', error);
        this.qrError.set('No se pudieron mostrar los QR. Podés usar los códigos manuales de cada entrada.');
      }
    } catch (error) {
      console.error('Error al cargar la reserva:', error);

      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar la reserva.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }

  get minorNotice(): boolean {
    const rating = this.booking()?.movie?.ageRating;
    return requiresAccompanyingAdult(rating);
  }

  seatTypeLabel(seatType: BookingTicket['seatType']): string {
    switch (seatType) {
      case 'accessible': return 'Accesible';
      case 'vip': return 'VIP';
      default: return 'Estándar';
    }
  }

  canDownloadPdf(): boolean {
    const tickets = this.booking()?.tickets;
    const purchase = this.booking();
    return !!purchase?.movie && !!purchase.showtime && !!tickets?.length && tickets.every(ticket => !!ticket.qrDataUrl);
  }

  async downloadPdf(): Promise<void> {
    const purchase = this.booking();
    const tickets = purchase?.tickets;
    if (!purchase?.movie || !purchase.showtime || !tickets?.length || !this.canDownloadPdf()) {
      this.pdfError.set('Las entradas todavía no están listas para generar el PDF.');
      return;
    }

    this.generatingPdf.set(true);
    this.pdfError.set('');
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      tickets.forEach((ticket, index) => {
        if (index > 0) pdf.addPage();
        pdf.setTextColor(36, 36, 36);
        pdf.setFontSize(10);
        pdf.text('CINEMAPP · ENTRADA', 20, 20);
        pdf.setFontSize(19);
        pdf.text(purchase.movie!.title, 20, 34, { maxWidth: 165 });
        pdf.setFontSize(11);
        pdf.text(this.formatDate(purchase.showtime!.date), 20, 48);
        pdf.text(`Horario: ${purchase.showtime!.time} · Sala ${purchase.showtime!.room}`, 20, 56);
        pdf.text(`Butaca: ${ticket.seatLabel} · ${this.seatTypeLabel(ticket.seatType)}`, 20, 68);
        pdf.text(`Precio de esta entrada: $${ticket.price.toFixed(2)}`, 20, 76);
        pdf.text(`Reserva: ${purchase.id}`, 20, 88, { maxWidth: 165 });
        pdf.addImage(ticket.qrDataUrl!, 'PNG', 20, 100, 55, 55);
        pdf.setFontSize(10);
        pdf.text(`Código manual: ${ticket.manualCode}`, 20, 164);
        if (this.minorNotice) {
          pdf.setFontSize(10);
          pdf.text(
            'Clasificación +13/+18: los menores deben concurrir acompañados por un adulto.',
            20,
            178,
            { maxWidth: 165 }
          );
        }
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text('Presentá esta entrada al ingresar. El QR es único para esta butaca.', 20, 195, { maxWidth: 165 });
      });
      pdf.save(`entrada-${purchase.id.slice(0, 8)}.pdf`);
    } catch (error) {
      console.error('Error al generar el PDF de las entradas:', error);
      this.pdfError.set('No se pudo generar el PDF. Intentá nuevamente.');
    } finally {
      this.generatingPdf.set(false);
    }
  }
}
