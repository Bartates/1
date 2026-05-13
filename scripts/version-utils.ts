/**
 * Resolves the versionCode for Android builds.
 *
 * This is the TypeScript equivalent of the Groovy expression:
 *   System.getenv("CI_PIPELINE_IID")?.toInteger() ?: 1
 *
 * @param value - The CI_PIPELINE_IID environment variable value
 * @returns The parsed version code as an integer, or 1 if the value is
 *          null, undefined, empty, or cannot be converted to an integer.
 *
 * Behavior:
 * - Valid integer string (e.g. "42") → returns that integer (42)
 * - null or undefined              → returns 1
 * - empty string ("")              → returns 1
 * - non-numeric string ("abc")     → returns 1
 * - mixed string ("123abc")        → returns 1 (full-string validation)
 * - NaN                            → returns 1
 */
export function resolveVersionCode(value: string | null | undefined): number {
  // Handle null, undefined, empty string, or whitespace-only string.
  // Groovy's String.toInteger() throws NumberFormatException for whitespace-only strings,
  // so we treat them the same as empty string.
  if (value == null || value.trim() === '') {
    return 1;
  }

  // Use Number() for strict full-string conversion (unlike parseInt which is lenient).
  // This mirrors Groovy's String.toInteger() which rejects partial matches like "123abc".
  const converted = Number(value);

  // Reject NaN and non-integer values (e.g. floats like "3.14")
  if (isNaN(converted) || !Number.isInteger(converted)) {
    return 1;
  }

  return converted;
}
