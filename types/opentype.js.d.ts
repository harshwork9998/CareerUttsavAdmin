declare module "opentype.js" {
  export interface Glyph {
    unicode?: number;
  }

  export interface Font {
    getPath(
      text: string,
      x: number,
      y: number,
      fontSize: number,
      options?: { letterSpacing?: number; kerning?: boolean }
    ): { toPathData(decimalPlaces?: number): string };
    getAdvanceWidth(
      text: string,
      fontSize: number,
      options?: { letterSpacing?: number; kerning?: boolean }
    ): number;
    charToGlyph(char: string): Glyph;
  }

  export function loadSync(filePath: string): Font;
}
