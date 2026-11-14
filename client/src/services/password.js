export const passwordRequirements = 'Use at least 12 characters and no more than 72 UTF-8 bytes.';

export function passwordError(password, isNew = false) {
  if (!password || password.includes('\0') || new TextEncoder().encode(password).length > 72) {
    return isNew ? passwordRequirements : 'Enter a valid password.';
  }
  return isNew && [...password].length < 12 ? passwordRequirements : '';
}
