export interface Rgb {
    r: number;
    g: number;
    b: number;
}
/** Parse a CSS color string into 0-255 RGB, or null if unparseable/transparent. */
export declare function parseColor(input: string): Rgb | null;
export declare function relativeLuminance({ r, g, b }: Rgb): number;
/** Contrast ratio between two colors, 1.0 (none) to 21.0 (max). */
export declare function contrastRatio(a: Rgb, b: Rgb): number;
