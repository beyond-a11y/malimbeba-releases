import type { Finding } from "../types.js";
export interface StatusMessageResult {
    url: string;
    triggered: boolean;
    autonomousChanges: number;
    triggeredChanges: number;
    findings: Finding[];
    error?: string;
}
export declare function runStatusMessageCheck(url: string, opts?: {
    triggerSelector?: string;
    observeMs?: number;
}): Promise<StatusMessageResult>;
