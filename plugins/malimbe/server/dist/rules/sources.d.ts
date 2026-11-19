export type ReferenceUse = "build" | "test" | "build+test";
export interface ExternalReference {
    name: string;
    url: string;
    /** One line: what it is and when to reach for it. */
    note: string;
    use: ReferenceUse;
}
export declare const EXTERNAL_REFERENCES: ExternalReference[];
export declare function referencesFor(use: ReferenceUse | "all"): ExternalReference[];
