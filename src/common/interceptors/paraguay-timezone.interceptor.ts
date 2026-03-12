import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DateService } from '../services/date.service';

/**
 * Interceptor que normaliza todas las fechas entrantes y salientes
 * a la zona horaria de Paraguay (America/Asuncion, UTC-3)
 * 
 * Esto asegura que:
 * 1. Las fechas entrantes se interpreten correctamente como hora de Paraguay
 * 2. Las fechas salientes se formateen correctamente para el cliente
 * 3. No haya desfases de 3 horas entre lo que ve el usuario y lo que se guarda
 */
@Injectable()
export class ParaguayTimezoneInterceptor implements NestInterceptor {
  constructor(private readonly dateService: DateService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Normalizar fechas en el body de la request
    if (request.body) {
      request.body = this.normalizeDatesInObject(request.body);
    }
    
    // Normalizar fechas en query params
    if (request.query) {
      request.query = this.normalizeDatesInObject(request.query);
    }

    return next.handle().pipe(
      map((data) => {
        // Normalizar fechas en la respuesta
        return this.normalizeResponseDates(data);
      }),
    );
  }

  /**
   * Normaliza fechas en un objeto recursivamente
   */
  private normalizeDatesInObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      // Si ya es Date, convertir a hora de Paraguay
      return this.dateService.toISOString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizeDatesInObject(item));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Detectar campos de fecha por nombre
      if (this.isDateField(key) && typeof value === 'string') {
        result[key] = this.parseParaguayDate(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.normalizeDatesInObject(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Detecta si un campo es de tipo fecha por su nombre
   */
  private isDateField(key: string): boolean {
    const datePatterns = [
      'fecha',
      'date',
      'hora',
      'time',
      'inicio',
      'fin',
      'start',
      'end',
      'created',
      'updated',
      'creado',
      'actualizado',
      'vencimiento',
      'expiracion',
    ];
    
    const lowerKey = key.toLowerCase();
    return datePatterns.some(pattern => lowerKey.includes(pattern));
  }

  /**
   * Parsea una fecha string como hora de Paraguay
   */
  private parseParaguayDate(dateString: string): string {
    try {
      // Si es formato ISO, interpretar como hora de Paraguay
      if (dateString.includes('T') || dateString.includes('Z')) {
        // Crear fecha interpretando el string como hora local de Paraguay
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          return dateString;
        }
        return this.dateService.toISOString(date);
      }
      
      // Si es formato YYYY-MM-DD, asumir que es hora 00:00 de Paraguay
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const paraguayDate = new Date(`${dateString}T00:00:00-03:00`);
        return paraguayDate.toISOString();
      }
      
      return dateString;
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Normaliza fechas en la respuesta
   */
  private normalizeResponseDates(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (data instanceof Date) {
      return this.dateService.format(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.normalizeResponseDates(item));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Date) {
        // Convertir Date a string formateado en hora de Paraguay
        result[key] = this.dateService.format(value);
      } else if (typeof value === 'string' && this.isISODateString(value)) {
        // Convertir string ISO a fecha formateada de Paraguay
        result[key] = this.formatISOString(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.normalizeResponseDates(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Verifica si un string es fecha ISO
   */
  private isISODateString(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }

  /**
   * Formatea un string ISO a formato legible de Paraguay
   */
  private formatISOString(isoString: string): string {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        return isoString;
      }
      return this.dateService.format(date);
    } catch (error) {
      return isoString;
    }
  }
}
