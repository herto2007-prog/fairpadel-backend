import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDocumento(value: string): string {
  // Remove non-numeric characters
  const numeric = value.replace(/\D/g, '');
  return numeric;
}

export function formatTelefono(value: string): string {
  // Remove non-numeric characters
  const numeric = value.replace(/\D/g, '');
  
  // Limit to 10 digits (Paraguay format)
  if (numeric.length > 10) {
    return numeric.slice(0, 10);
  }
  
  return numeric;
}

export function validateTelefono(value: string): boolean {
  return /^09[0-9]{8}$/.test(value);
}

export function validateDocumento(value: string): boolean {
  return /^[0-9]+$/.test(value) && value.length >= 5;
}
