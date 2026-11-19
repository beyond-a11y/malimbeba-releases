import { type OrderMismatch } from "./visualOrder.js";
import type { Finding } from "../types.js";
export interface ReadingOrderResult {
    url: string;
    /** Meaningful content elements found (headings, text, links, controls, images-with-alt). */
    itemCount: number;
    orderMismatches: OrderMismatch[];
    findings: Finding[];
    error?: string;
}
/**
 * Compare DOM order of a page's meaningful content against its rendered
 * (visual) position, in a single static snapshot -- no interaction needed,
 * unlike keyboard.ts's walkthrough.
 */
export declare function runReadingOrderCheck(url: string): Promise<ReadingOrderResult>;
