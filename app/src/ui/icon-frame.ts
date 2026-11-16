// The icon families' shared drawing: a glyph on a 24-unit grid, shrunk into its family's frame and coloured by its class.

/** A family's frame: its outline, how far the glyph shrinks into it, and the glyph's line weight there. */
export interface Frame {
  outline: string
  scale: number
  stroke: number
}

/** `glyph` in `frame`, titled `name`, drawn in the colour of CSS class `cls`. */
export const framed = (cls: string, frame: Frame, glyph: string, name: string) =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" role="img"><title>${name}</title>${frame.outline}<g stroke-width="${frame.stroke}" transform="translate(12 12) scale(${frame.scale}) translate(-12 -12)">${glyph}</g></svg>`
