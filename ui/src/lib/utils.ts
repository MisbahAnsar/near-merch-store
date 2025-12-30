import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toUrlProductId(fullId: string): string {
  return fullId.replace(/^[a-z]+-product-/, '');
}

export function toFullProductId(urlId: string): string {
  if (urlId.includes('-product-')) return urlId;
  return `printful-product-${urlId}`;
}
