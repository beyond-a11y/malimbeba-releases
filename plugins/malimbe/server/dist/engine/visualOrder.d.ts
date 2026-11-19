/**
 * Shared DOM-order-vs-visual-position heuristic. Extracted so
 * keyboard.ts's focus-order check and readingOrder.ts's content-order
 * check can never quietly diverge on the threshold or the comparison
 * logic -- the same mistake this codebase has made before with
 * hand-duplicated logic (see CLAUDE.md's history of promptBuilder.ts's
 * consolidation for the same reasoning applied to prompt assembly).
 *
 * This is a heuristic, not a hard failure: some backward jumps are
 * intentional (a "skip to content" link, a sidebar that legitimately
 * comes after the main content in reading order but appears first
 * visually by design). Callers report it for review, never as an
 * automatic fail.
 */
export interface OrderMismatch {
    from: string;
    to: string;
    detail: string;
}
/** An upward jump smaller than this is ordinary same-row/toolbar
 *  movement, not a reading-order problem worth flagging. */
export declare const ORDER_JUMP_THRESHOLD_PX = 40;
export interface PositionedItem {
    x: number;
    y: number;
}
/**
 * Walk a sequence in the order it was actually encountered (DOM order,
 * or the order Tab actually visited) and flag every step where the next
 * item's vertical position is meaningfully ABOVE the previous one's --
 * i.e. the sequence order runs backward against top-to-bottom visual
 * layout.
 *
 * @param subjectLabel What jumped, for the detail message ("Focus",
 *   "Reading order").
 */
export declare function findOrderMismatches<T extends PositionedItem>(sequence: T[], describe: (item: T) => string, subjectLabel: string): OrderMismatch[];
