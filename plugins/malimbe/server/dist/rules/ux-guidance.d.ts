export type UxConfidence = "stable" | "standard" | "emerging";
export type SourceStatus = "fetched" | "partial";
export interface UxSource {
    id: string;
    title: string;
    publisher: string;
    url: string;
    status: SourceStatus;
}
export interface UxTopic {
    id: string;
    title: string;
    confidence: UxConfidence;
    summary: string;
    rules: string[];
    /** Places where authoritative sources disagree; decide with your own research. */
    tensions?: string[];
    /** Questions to ask when reviewing a design or implementation against this topic. */
    reviewQuestions: string[];
    wcag?: string[];
    sources: string[];
    /** Words in a task description that make this topic relevant. */
    keywords: string[];
}
export declare const UX_REVIEW: {
    readonly lastReviewed: "2026-10-26";
    readonly nextReviewDue: "2027-04-26";
    readonly cadenceMonths: 6;
};
export declare const UX_SOURCES: UxSource[];
export declare const UX_TOPICS: UxTopic[];
export declare const UX_TOPIC_INDEX: Map<string, UxTopic>;
export declare const UX_SOURCE_INDEX: Map<string, UxSource>;
/** Pick topics relevant to a free-text task. Falls back to the cross-cutting set. */
export declare function selectTopics(task: string): UxTopic[];
export declare function reviewStatus(now?: Date): {
    stale: boolean;
    message: string;
};
