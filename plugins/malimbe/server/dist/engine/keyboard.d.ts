import { type OrderMismatch } from "./visualOrder.js";
import type { Finding } from "../types.js";
export interface KeyboardWalkResult {
    url: string;
    /** Candidates matching FOCUSABLE_SELECTOR, visible, enabled, not aria-hidden/inert. */
    expectedCount: number;
    /** Of those, how many the Tab walk actually landed on. */
    reachedCount: number;
    unreachable: Array<{
        selector: string;
        snippet: string;
    }>;
    trapped: boolean;
    trapAt?: string;
    /** Tab presses actually issued before stopping (natural end, trap, or the cap). */
    steps: number;
    /** Hit the step cap without reaching a natural end -- result is a lower bound, not exhaustive. */
    incomplete: boolean;
    orderMismatches: OrderMismatch[];
    findings: Finding[];
    error?: string;
}
/**
 * Drive real Tab/Shift+Tab key presses through a rendered page and report
 * what a keyboard-only user would actually experience: elements that are
 * visible and enabled but never reached, a Tab sequence that loops without
 * making progress (a trap), and focus order that jumps backward against
 * the visual layout (WCAG 2.4.3-adjacent heuristic -- flagged for review,
 * not asserted as a hard failure, since some backward jumps are
 * intentional, e.g. a "skip to content" link).
 */
export declare function runKeyboardWalkthrough(url: string, opts?: {
    maxSteps?: number;
}): Promise<KeyboardWalkResult>;
