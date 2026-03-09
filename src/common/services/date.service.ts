import { Injectable } from '@nestjs/common';

/**
 * Servicio para manejar fechas en zona horaria de Paraguay (UTC-3)
 * Toda la aplicación debe usar este servicio para obtener fechas consistentes
 */
@Injectable()
export class DateService {
  private readonly TIMEZONE = 'America/Asuncion';
  private readonly LOCALE = 'es-PY';

  /**
   * Obtiene la fecha y hora actual en Paraguay
   */
  now(): Date {
    return new Date();
  }

  /**
   * Obtiene la fecha y hora actual formateada para Paraguay
   */
  formatNow(): string {
    return this.format(new Date());
  }

  /**
   * Formatea una fecha a string en zona horaria de Paraguay
   */
  format(date: Date): string {
    return date.toLocaleString(this.LOCALE, {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  /**
   * Convierte una fecha a ISO string con timezone de Paraguay
   */
  toISOString(date: Date = new Date()): string {
    const paraguayDate = new Date(
      date.toLocaleString('en-US', { timeZone: this.TIMEZONE }),
    );
    return paraguayDate.toISOString();
  }

  /**
   * Obtiene solo la fecha en formato YYYY-MM-DD para Paraguay
   */
  getDateOnly(date: Date = new Date()): string {
    return date.toLocaleDateString('en-CA', {
      timeZone: this.TIMEZONE,
    });
  }

  /**
   * Obtiene solo la hora en formato HH:mm:ss para Paraguay
   */
  getTimeOnly(date: Date = new Date()): string {
    return date.toLocaleTimeString(this.LOCALE, {
      timeZone: this.TIMEZONE,
      hour12: false,
    });
  }

  /**
   * Verifica si una fecha es hoy en Paraguay
   */
  isToday(date: Date): boolean {
    const paraguayToday = this.getDateOnly();
    const paraguayDate = this.getDateOnly(date);
    return paraguayToday === paraguayDate;
  }
}
