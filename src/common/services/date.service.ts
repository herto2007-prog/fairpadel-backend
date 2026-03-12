import { Injectable } from '@nestjs/common';

/**
 * Servicio para manejar fechas en zona horaria de Paraguay (UTC-3)
 * Toda la aplicación debe usar este servicio para obtener fechas consistentes
 */
@Injectable()
export class DateService {
  private readonly TIMEZONE = 'America/Asuncion';
  private readonly LOCALE = 'es-PY';
  private readonly UTC_OFFSET = -3; // Paraguay es UTC-3

  /**
   * Obtiene la fecha y hora actual en Paraguay
   */
  now(): Date {
    return this.convertToParaguayDate(new Date());
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
   * Formatea solo la fecha (sin hora) en formato Paraguay
   */
  formatDate(date: Date): string {
    return date.toLocaleDateString(this.LOCALE, {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  /**
   * Formatea solo la hora en formato Paraguay
   */
  formatTime(date: Date): string {
    return date.toLocaleTimeString(this.LOCALE, {
      timeZone: this.TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  /**
   * Convierte una fecha a ISO string con timezone de Paraguay
   * Esto asegura que al guardar en BD, se guarde correctamente
   */
  toISOString(date: Date = new Date()): string {
    // Crear fecha en hora de Paraguay y convertir a ISO
    const paraguayDate = this.convertToParaguayDate(date);
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

  /**
   * Parsea un string de fecha como hora de Paraguay
   * @param dateString Puede ser ISO, YYYY-MM-DD, o cualquier formato válido
   * @returns Date en hora de Paraguay
   */
  parse(dateString: string): Date {
    // Si es formato YYYY-MM-DD (sin hora), asumir 00:00 Paraguay
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return new Date(`${dateString}T00:00:00-03:00`);
    }

    // Si es ISO con timezone, parsear directamente
    if (dateString.includes('T')) {
      // Crear fecha interpretando como hora local de Paraguay
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return this.convertToParaguayDate(date);
      }
    }

    // Fallback: parsear normalmente
    return new Date(dateString);
  }

  /**
   * Agrega horas a una fecha en hora de Paraguay
   */
  addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return this.convertToParaguayDate(result);
  }

  /**
   * Agrega días a una fecha en hora de Paraguay
   */
  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return this.convertToParaguayDate(result);
  }

  /**
   * Obtiene el inicio del día (00:00:00) en Paraguay
   */
  startOfDay(date: Date = new Date()): Date {
    const dateStr = this.getDateOnly(date);
    return new Date(`${dateStr}T00:00:00-03:00`);
  }

  /**
   * Obtiene el fin del día (23:59:59) en Paraguay
   */
  endOfDay(date: Date = new Date()): Date {
    const dateStr = this.getDateOnly(date);
    return new Date(`${dateStr}T23:59:59-03:00`);
  }

  /**
   * Obtiene un rango de fechas entre inicio y fin
   */
  getDatesRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  /**
   * Compara dos fechas (solo la parte de fecha, no hora)
   * Retorna: -1 si date1 < date2, 0 si son iguales, 1 si date1 > date2
   */
  compareDates(date1: Date, date2: Date): number {
    const d1 = this.getDateOnly(date1);
    const d2 = this.getDateOnly(date2);
    
    if (d1 < d2) return -1;
    if (d1 > d2) return 1;
    return 0;
  }

  /**
   * Convierte cualquier fecha a hora de Paraguay
   * Esto es crucial para evitar desfases de timezone
   */
  private convertToParaguayDate(date: Date): Date {
    // Crear string de fecha en timezone de Paraguay
    const paraguayString = date.toLocaleString('en-US', {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    return new Date(paraguayString);
  }

  /**
   * Obtiene el nombre del día de la semana en español
   */
  getDayName(date: Date): string {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dayIndex = parseInt(date.toLocaleString('en-US', {
      timeZone: this.TIMEZONE,
      weekday: 'narrow',
    }));
    return days[dayIndex];
  }

  /**
   * Obtiene el nombre del mes en español
   */
  getMonthName(date: Date): string {
    return date.toLocaleString(this.LOCALE, {
      timeZone: this.TIMEZONE,
      month: 'long',
    });
  }
}
