export function nonEmptyOrNull(value: string | null | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}
