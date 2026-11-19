export interface AccessibleEntry {
    role: string;
    name: string;
    description: string;
    states: string[];
    selector: string;
    snippet: string;
}
export interface AnnouncementFinding {
    ruleId: "announcement-missing-name" | "announcement-generic-name" | "announcement-repeated-name";
    impact: "serious" | "moderate";
    selector: string;
    snippet: string;
    detail: string;
    fix: string;
}
export interface ScreenReaderReview {
    url: string;
    engine: "Chromium accessibility tree via CDP";
    entries: AccessibleEntry[];
    findings: AnnouncementFinding[];
    note: string;
    error?: string;
}
interface AXNode {
    ignored?: boolean;
    role?: {
        value?: string;
    };
    name?: {
        value?: string;
    };
    description?: {
        value?: string;
    };
    properties?: Array<{
        name: string;
        value?: {
            value?: unknown;
        };
    }>;
    backendDOMNodeId?: number;
}
export declare function reviewAccessibleEntries(url: string, nodes: AXNode[]): ScreenReaderReview;
/** Snapshot Chromium's computed accessibility tree for visible interactive semantics. */
export declare function runScreenReaderReview(url: string): Promise<ScreenReaderReview>;
export {};
