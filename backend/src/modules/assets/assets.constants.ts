export const ASSET_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const ASSET_MAX_FILES_PER_REQUEST = 5;

export const ASSET_ALLOWED_MIME_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
