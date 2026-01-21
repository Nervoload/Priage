// backend/src/common/decorators/sanitize.decorator.ts
// Custom decorator to sanitize string inputs

import { Transform } from 'class-transformer';

/**
 * Sanitize string input by trimming whitespace and removing potentially dangerous characters
 */
export function Sanitize() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    
    // Trim whitespace
    let sanitized = value.trim();
    
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    // Optionally remove or escape HTML tags (basic XSS protection)
    // For now, we just strip tags - for rich text, use a proper sanitizer library
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    
    return sanitized;
  });
}

/**
 * Sanitize and normalize email addresses
 */
export function SanitizeEmail() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return value.trim().toLowerCase();
  });
}
