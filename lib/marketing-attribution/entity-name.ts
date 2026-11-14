/** Case-insensitive identity key for marketing configuration names. */
export function marketingEntityNameKey(name: string): string {
  return name.trim().toLowerCase();
}