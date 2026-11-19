/**
 * The pre-production gap: Accessibility Review always needed a URL, but the
 * moment a developer wants a check is BEFORE anything is hosted — no dev server,
 * no preview deploy, nothing promoted. This harness turns unhosted component
 * code into a real http://localhost target that the axe/Playwright tools can
 * scan for real, so "check my work" works on work that only exists on disk.
 *
 * It is deliberately ephemeral, loopback-only, and single-purpose: mount some
 * code + usage markup, get a URL, audit it, tear it down.
 */
export interface DemoAsset {
    /** Local file paths (JS/CSS) to include, resolved against cwd. */
    files?: string[];
    /** Inline script bodies (e.g. a pasted component definition). */
    scripts?: string[];
    /** Inline stylesheet bodies. */
    styles?: string[];
    /** ES module specifiers to import via an import map + module scripts. */
    modules?: string[];
}
export interface DemoPageSpec {
    /** Body markup that exercises the component(s). */
    markup: string;
    /** Optional <title>. */
    title?: string;
    /** Language for <html lang>. */
    lang?: string;
    assets?: DemoAsset;
}
export interface DemoServer {
    url: string;
    port: number;
    close: () => Promise<void>;
}
/** Build the demo document from a spec. Served files are referenced by path. */
export declare function buildDemoHtml(spec: DemoPageSpec, servedFiles: string[]): string;
/**
 * Start an ephemeral loopback HTTP server that serves one demo page plus any
 * whitelisted local asset files. Binds to 127.0.0.1 on an OS-assigned port.
 */
export declare function serveDemo(spec: DemoPageSpec, opts?: {
    port?: number;
}): Promise<DemoServer>;
/** Read component source from disk into inline scripts (for paths under cwd). */
export declare function loadSourceFiles(paths: string[]): {
    scripts: string[];
    errors: string[];
};
