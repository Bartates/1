/**
 * manualChunks — Vite/Rollup chunk assignment function.
 *
 * Assigns each node_modules module to a named chunk based on the first
 * matching rule (priority order matters). Returns undefined for modules
 * that should remain in the default chunk.
 *
 * Chunk priority order:
 * 1. react / react-dom  → 'vendor'
 * 2. @capacitor         → 'capacitor'
 * 3. @radix-ui          → 'radix'
 * 4. recharts / d3-     → 'charts'
 * 5. framer-motion      → 'animations'
 * 6. lucide-react       → 'icons'
 * 7. xlsx               → 'excel'
 */
export function manualChunks(id: string): string | undefined {
  // Vendor chunk
  if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor';
  // Capacitor chunk
  if (id.includes('@capacitor')) return 'capacitor';
  // Radix UI chunk
  if (id.includes('@radix-ui')) return 'radix';
  // Recharts / D3 chunk
  if (id.includes('recharts') || id.includes('d3-')) return 'charts';
  // Framer Motion animations chunk
  if (id.includes('framer-motion')) return 'animations';
  // Lucide React icons chunk
  if (id.includes('lucide-react')) return 'icons';
  // xlsx Excel processing chunk
  if (id.includes('xlsx')) return 'excel';
  return undefined;
}
