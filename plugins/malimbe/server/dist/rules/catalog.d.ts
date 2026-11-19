export interface CatalogEntry {
    /** Canonical key — matches GUIDANCE[].component and RISK_TIERS naming exactly. */
    component: string;
    /** Human-readable label for UI display. */
    label: string;
    tier: number;
    /** True if a11y_component_guidance / a11y_build_prompt can inject a full APG contract. */
    hasContract: boolean;
}
export declare const DESIGN_SYSTEM_COMPONENT = "design system";
export declare const CATALOG: CatalogEntry[];
export declare const CATALOG_INDEX: Map<string, CatalogEntry>;
export declare function catalogLabel(component: string): string;
/** Display name for each risk tier, e.g. { 1: "Primitive controls", ... }. */
export declare const TIER_LABEL: Record<number, string>;
