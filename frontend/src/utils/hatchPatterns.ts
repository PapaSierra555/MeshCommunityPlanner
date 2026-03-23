/**
 * hatchPatterns.ts
 * SVG pattern injection for coverage circle hatch mode.
 *
 * Each node index gets a unique color + pattern type. When two circles
 * overlap in Leaflet's SVG overlay, their pattern fills stack — the gaps
 * in the top pattern reveal the bottom pattern, producing a visual
 * cross-hatch without any explicit intersection geometry.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFS_ID = 'mesh-hatch-defs';
const PATTERN_PREFIX = 'mesh-hatch-';

/** 8 perceptually distinct colors, colorblind-friendly where possible. */
export const HATCH_COLORS: readonly string[] = [
  '#2563EB', // blue
  '#D97706', // amber
  '#16A34A', // green
  '#DC2626', // red
  '#7C3AED', // purple
  '#0891B2', // cyan
  '#EA580C', // orange
  '#BE185D', // pink
];

export const PATTERN_TYPES = [
  'diag-right',
  'diag-left',
  'horizontal',
  'vertical',
  'dots',
  'cross',
] as const;

export type PatternType = (typeof PATTERN_TYPES)[number];

/** Return the stroke color assigned to a node by index (cycles every 8). */
export function getNodeHatchColor(index: number): string {
  return HATCH_COLORS[index % HATCH_COLORS.length];
}

/** Return the SVG pattern ID for a node index. */
export function getPatternId(index: number): string {
  return `${PATTERN_PREFIX}${index}`;
}

/** Return the PatternType assigned to a node index (cycles every 6). */
export function getPatternType(index: number): PatternType {
  return PATTERN_TYPES[index % PATTERN_TYPES.length];
}

/**
 * Build and return an SVGPatternElement for the given node index.
 * Pattern background is transparent — only the lines/dots are colored.
 * This ensures overlapping circles reveal both patterns simultaneously.
 */
function createPatternElement(
  doc: Document,
  patternId: string,
  color: string,
  nodeIndex: number
): SVGPatternElement {
  const type = getPatternType(nodeIndex);
  const size = 12;

  const pat = doc.createElementNS(SVG_NS, 'pattern');
  pat.setAttribute('id', patternId);
  pat.setAttribute('patternUnits', 'userSpaceOnUse');
  pat.setAttribute('width', String(size));
  pat.setAttribute('height', String(size));

  const mk = (tag: string, attrs: Record<string, string>): Element => {
    const el = doc.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  const S = String(size);
  const H = String(size / 2);
  const lineAttrs = { stroke: color, 'stroke-width': '2', 'stroke-linecap': 'square' };

  switch (type) {
    case 'diag-right': // /////
      pat.appendChild(mk('line', { x1: '0', y1: S, x2: S, y2: '0', ...lineAttrs }));
      break;
    case 'diag-left': // \\\\\
      pat.appendChild(mk('line', { x1: '0', y1: '0', x2: S, y2: S, ...lineAttrs }));
      break;
    case 'horizontal': // -----
      pat.appendChild(mk('line', { x1: '0', y1: H, x2: S, y2: H, ...lineAttrs }));
      break;
    case 'vertical': // |||||
      pat.appendChild(mk('line', { x1: H, y1: '0', x2: H, y2: S, ...lineAttrs }));
      break;
    case 'dots':
      pat.appendChild(mk('circle', { cx: H, cy: H, r: '2', fill: color }));
      break;
    case 'cross': // +++
      pat.appendChild(mk('line', { x1: '0', y1: H, x2: S, y2: H, ...lineAttrs }));
      pat.appendChild(mk('line', { x1: H, y1: '0', x2: H, y2: S, ...lineAttrs }));
      break;
  }

  return pat as SVGPatternElement;
}

/**
 * Inject hatch pattern defs into a Leaflet overlay SVG element.
 * Safe to call multiple times — skips patterns that already exist.
 */
export function ensureHatchPatterns(svgEl: SVGSVGElement, count: number): void {
  const doc = svgEl.ownerDocument;

  let defs = svgEl.querySelector(`#${DEFS_ID}`) as SVGDefsElement | null;
  if (!defs) {
    defs = doc.createElementNS(SVG_NS, 'defs') as SVGDefsElement;
    (defs as Element).id = DEFS_ID;
    svgEl.insertBefore(defs, svgEl.firstChild);
  }

  for (let i = 0; i < count; i++) {
    const patternId = getPatternId(i);
    if (!svgEl.querySelector(`#${patternId}`)) {
      const color = getNodeHatchColor(i);
      const pattern = createPatternElement(doc, patternId, color, i);
      defs.appendChild(pattern);
    }
  }
}

/**
 * Remove all injected hatch pattern defs from the SVG element.
 * Called when hatch mode is toggled off.
 */
export function removeHatchPatterns(svgEl: SVGSVGElement): void {
  const defs = svgEl.querySelector(`#${DEFS_ID}`);
  if (defs) defs.remove();
}
