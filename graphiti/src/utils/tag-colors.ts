/**
 * Tag colors matching Pubky-app/franky
 * Source: https://github.com/pubky/franky/blob/master/src/libs/utils/utils.ts (line 99)
 * Updated to use darker, more saturated colors as seen in Pubky App
 */

const TAG_COLORS = [
  '#DC2626', // Dark Red
  '#059669', // Dark Teal/Emerald
  '#2563EB', // Dark Blue
  '#EA580C', // Dark Orange
  '#0891B2', // Dark Cyan
  '#CA8A04', // Dark Yellow/Gold
  '#9333EA', // Dark Purple
  '#0284C7', // Dark Sky Blue
  '#C2410C', // Dark Rust
  '#7C3AED', // Dark Violet
];

/**
 * Get a consistent color for a tag based on its label
 * Matches the Pubky-app tag color system
 */
export function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const index = Math.abs(hash) % TAG_COLORS.length;
  return TAG_COLORS[index];
}

/**
 * Get tag style for inline use
 */
export function getTagStyle(tag: string): { backgroundColor: string; color: string } {
  const bgColor = getTagColor(tag);
  return {
    backgroundColor: bgColor,
    color: '#FFFFFF',
  };
}

