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
/** An upward jump smaller than this is ordinary same-row/toolbar
 *  movement, not a reading-order problem worth flagging. */
export const ORDER_JUMP_THRESHOLD_PX = 40;
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
export function findOrderMismatches(sequence, describe, subjectLabel) {
    const mismatches = [];
    for (let i = 1; i < sequence.length; i++) {
        const prev = sequence[i - 1];
        const cur = sequence[i];
        if (cur.y < prev.y - ORDER_JUMP_THRESHOLD_PX) {
            mismatches.push({
                from: describe(prev),
                to: describe(cur),
                detail: `${subjectLabel} jumped ${Math.round(prev.y - cur.y)}px upward, against the top-to-bottom visual layout.`,
            });
        }
    }
    return mismatches;
}
