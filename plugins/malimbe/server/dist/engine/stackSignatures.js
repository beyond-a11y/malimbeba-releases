/**
 * Platform and stack signatures, as data. The engine in stack.ts is generic:
 * adding a platform means adding an entry here, not changing the engine.
 *
 * Confidence comes from the strongest matcher that fired (see stack.ts):
 *   high   = a generator tag, a product-specific header, a product-only global
 *            or version constant, or a file path only that product serves
 *   medium = a script/stylesheet name, a DOM marker class, a cookie name
 *   low    = a generic hint shared with other products
 *
 * Lifecycle data is static, dated (`asOf`) and sourced. It is never fetched
 * at runtime.
 */
/**
 * Version probes evaluated in the page. Each one reads a single primitive
 * version constant or flag; nothing here reads user data, storage or cookies.
 * Keys are referenced by `probe` matchers and version sources below.
 */
export const VERSION_PROBES = {
    "jquery": "window.jQuery && window.jQuery.fn && window.jQuery.fn.jquery",
    "jqueryUi": "window.jQuery && window.jQuery.ui && window.jQuery.ui.version",
    "bootstrap": "(function(){var j=window.jQuery&&window.jQuery.fn;var n=['tooltip','modal','collapse','dropdown','carousel','popover','tab','alert','button','scrollspy'];if(j){for(var i=0;i<n.length;i++){var p=j[n[i]];if(p&&p.Constructor&&p.Constructor.VERSION)return p.Constructor.VERSION;}}var b=window.bootstrap;if(b){for(var k=0;k<n.length;k++){var c=b[n[k].charAt(0).toUpperCase()+n[k].slice(1)];if(c&&c.VERSION)return c.VERSION;}}return undefined;})()",
    "spClientTag": "window._spPageContextInfo && window._spPageContextInfo.siteClientTag",
    "spUiVersion": "window._spPageContextInfo && window._spPageContextInfo.webUIVersion",
    "reactRouterSsr": "window.__reactRouterContext && window.__reactRouterContext.ssr",
    "reactRouterSpaMode": "window.__reactRouterContext && window.__reactRouterContext.isSpaMode",
    "reactDom": "(function(){var els=document.querySelectorAll('body, body > *, #root, #app, #__next');for(var i=0;i<els.length;i++){for(var k in els[i]){if(k.indexOf('__reactFiber$')===0||k.indexOf('__reactContainer$')===0||k==='_reactRootContainer')return true;}}return undefined;})()",
    "react": "window.React && window.React.version",
    "vue": "window.Vue && window.Vue.version",
    "next": "window.next && window.next.version",
    "gsap": "(window.gsap && window.gsap.version) || (window.TweenMax && window.TweenMax.version)",
    "yui": "window.YUI && window.YUI.version",
    "slick": "window.jQuery && window.jQuery.fn && typeof window.jQuery.fn.slick === 'function' || undefined",
    "bxslider": "window.jQuery && window.jQuery.fn && typeof window.jQuery.fn.bxSlider === 'function' || undefined",
    "selectboxit": "window.jQuery && window.jQuery.fn && typeof window.jQuery.fn.selectBoxIt === 'function' || undefined",
    "select2": "window.jQuery && window.jQuery.fn && typeof window.jQuery.fn.select2 === 'function' || undefined",
    "chosen": "window.jQuery && window.jQuery.fn && typeof window.jQuery.fn.chosen === 'function' || undefined",
    "owl": "window.jQuery && window.jQuery.fn && typeof window.jQuery.fn.owlCarousel === 'function' || undefined",
};
const AS_OF = "2026-11-16";
const OVERLAY_NOTES = [
    "Overlays change the page at runtime. They do not change the site's own code, so every finding still has to be fixed in the platform, template or component that produced it.",
    "Results can differ with the overlay active. Test with it on and off, and with real assistive technology.",
];
export const SIGNATURES = [
    // ── Platforms ──────────────────────────────────────────────────────────
    {
        id: "sharepoint-online",
        name: "Microsoft SharePoint Online",
        category: "platform",
        match: [
            { kind: "host", pattern: /\.sharepoint\.com$/i, strength: "high" },
        ],
        fixLayer: "template",
        notes: [
            "Out-of-the-box SharePoint controls (ribbon, list views, web parts) are rendered by Microsoft. Fix them through SPFx custom components or supported customization, not by editing the delivered markup.",
        ],
        attribution: [
            { selector: "#s4-ribbonrow", label: "SharePoint ribbon" },
            { selector: "[id^='spPageChromeAppDiv'], [data-sp-feature-tag]", label: "SharePoint page chrome" },
        ],
    },
    {
        id: "sharepoint-server",
        name: "Microsoft SharePoint Server",
        category: "platform",
        match: [
            { kind: "header", name: "microsoftsharepointteamservices", strength: "high" },
            { kind: "generator", pattern: /Microsoft SharePoint/i, strength: "high" },
            { kind: "global", name: "_spPageContextInfo", strength: "high" },
            { kind: "script", pattern: /\/_layouts\/1[56]\//i, strength: "medium" },
            { kind: "selector", selector: "#s4-ribbonrow", strength: "medium" },
        ],
        version: [
            { from: "header", name: "microsoftsharepointteamservices", pattern: /^(\d+\.\d+)\.0\.(\d+)/ },
            { from: "probe", key: "spClientTag", pattern: /(\d+\.\d+\.\d+)\.\d+$/ },
        ],
        fixLayer: "template",
        notes: [
            "SharePoint renders the ribbon, navigation controls, list views and out-of-the-box web parts. Fix those with master page or page layout overrides, display templates, or custom web parts; direct edits to delivered markup are overwritten.",
            "Custom branding and scripts the site adds (for example, under the Style Library) are the site's own code and can be fixed directly.",
        ],
        attribution: [
            { selector: "#s4-ribbonrow", label: "SharePoint ribbon" },
            { selector: "#suiteBar, #suiteBarTop", label: "SharePoint suite bar" },
            { selector: ".ms-core-listMenu-horizontalBox, .ms-core-listMenu-verticalBox", label: "SharePoint navigation control" },
            { selector: ".ms-listviewtable, .ms-listviewgrid", label: "SharePoint list view" },
        ],
    },
    {
        id: "liferay-dxp",
        name: "Liferay DXP",
        category: "platform",
        match: [
            { kind: "header", name: "liferay-portal", strength: "high" },
            { kind: "global", name: "Liferay", strength: "high" },
            { kind: "stylesheet", pattern: /\/o\/frontend-(js|taglib)-/i, strength: "high" },
            { kind: "cookie", pattern: /^(GUEST_LANGUAGE_ID|LFR_SESSION_STATE_\d+|COOKIE_SUPPORT)$/, strength: "medium" },
            { kind: "selector", selector: "[class*='lfr-']", strength: "medium" },
        ],
        version: [{ from: "header", name: "liferay-portal", pattern: /(\d+\.\d+(?:\.\d+)?(?:\s*(?:GA|U|Q)\S*)?)/ }],
        fixLayer: "template",
        notes: [
            "Liferay's portlets (navigation menu, search, breadcrumbs) render their own markup. Fix them with a theme or Application Display Template (ADT) override, or replace them with a custom fragment or widget.",
            "Fragments on content pages are authored by the site team and can be fixed directly in the fragment code.",
        ],
        attribution: [
            { selector: ".navbar-site[role='menubar']", label: "Liferay navigation menu portlet" },
            { selector: "[id*='com_liferay_site_navigation_menu']", label: "Liferay navigation menu portlet" },
            { selector: ".pagination-bar, .pagination-results", label: "Liferay Clay pagination" },
        ],
    },
    {
        id: "ektron",
        name: "Ektron CMS",
        category: "platform",
        match: [
            { kind: "stylesheet", pattern: /ektron\.stylesheet\.ashx/i, strength: "high" },
            { kind: "script", pattern: /\/WorkArea\/.*ektron|ektron\.javascript\.ashx/i, strength: "high" },
            { kind: "cookie", pattern: /^EktGUID$/, strength: "high" },
            { kind: "global", name: "Ektron", strength: "high" },
            { kind: "stylesheet", pattern: /\/WorkArea\//i, strength: "medium" },
        ],
        fixLayer: "template",
        notes: [
            "Ektron templates are ASP.NET Web Forms pages and controls, so most markup is the site's own template code and can be fixed there. Ektron's built-in server controls emit their own markup and need template or control overrides.",
        ],
        lifecycle: {
            status: "Acquired by Episerver (now Optimizely) in 2015. Optimizely says active development has ceased and it is migrating Ektron customers to Optimizely CMS. No end-of-support date is published.",
            asOf: AS_OF,
            source: "https://www.optimizely.com/ektron",
        },
    },
    {
        id: "sitecore",
        name: "Sitecore",
        category: "platform",
        match: [
            { kind: "cookie", pattern: /^(SC_ANALYTICS_GLOBAL_COOKIE|sxa_site|sc_expview)$/, strength: "high" },
            { kind: "script", pattern: /\/sitecore\/shell\/|\/-\/media\//i, strength: "medium" },
            { kind: "stylesheet", pattern: /\/-\/media\//i, strength: "medium" },
        ],
        fixLayer: "template",
        notes: ["Sitecore renderings are the site's own components (MVC or headless); fix them in the rendering code. SXA components need theme or rendering-variant overrides."],
    },
    {
        id: "aem",
        name: "Adobe Experience Manager",
        category: "platform",
        match: [
            { kind: "script", pattern: /\/etc\.clientlibs\//i, strength: "high" },
            { kind: "stylesheet", pattern: /\/etc\.clientlibs\//i, strength: "high" },
            { kind: "script", pattern: /\/etc\/designs\//i, strength: "medium" },
            { kind: "selector", selector: "[class*='aem-Grid']", strength: "medium" },
        ],
        fixLayer: "template",
        notes: ["AEM Core Components can be fixed by proxying and overriding the component's HTL; custom components are the site's own code."],
    },
    {
        id: "drupal",
        name: "Drupal",
        category: "platform",
        match: [
            { kind: "generator", pattern: /Drupal/i, strength: "high" },
            { kind: "header", name: "x-generator", value: /Drupal/i, strength: "high" },
            { kind: "header", name: "x-drupal-cache", strength: "high" },
            { kind: "header", name: "x-drupal-dynamic-cache", strength: "high" },
            { kind: "global", name: "Drupal", strength: "high" },
            { kind: "inline", pattern: /drupalSettings/, strength: "high" },
            { kind: "script", pattern: /\/(sites\/(all|default)|core\/misc)\//i, strength: "medium" },
        ],
        version: [{ from: "generator", pattern: /Drupal (\d+)/i }],
        fixLayer: "template",
        notes: ["Fix markup in the theme's Twig templates and in contributed modules' template overrides; patch modules only when a template can't reach the markup."],
    },
    {
        id: "wordpress",
        name: "WordPress",
        category: "platform",
        match: [
            { kind: "generator", pattern: /WordPress/i, strength: "high" },
            { kind: "header", name: "link", value: /api\.w\.org/i, strength: "high" },
            { kind: "script", pattern: /\/wp-(content|includes)\//i, strength: "medium" },
            { kind: "stylesheet", pattern: /\/wp-(content|includes)\//i, strength: "medium" },
        ],
        version: [{ from: "generator", pattern: /WordPress ([\d.]+)/i }],
        fixLayer: "template",
        notes: ["Fix theme templates (or a child theme) and block markup; plugin output needs plugin settings, hooks or replacement."],
    },
    {
        id: "optimizely-cms",
        name: "Optimizely CMS (Episerver)",
        category: "platform",
        match: [
            { kind: "script", pattern: /\/(EPiServer|episerver)\//, strength: "medium" },
            { kind: "cookie", pattern: /^(EPi:|EPiStateMarker|\.EPiForm)/, strength: "high" },
            { kind: "global", name: "epi", strength: "medium" },
        ],
        fixLayer: "template",
        notes: ["Optimizely page and block templates are the site's own Razor views; fix them there. Optimizely Forms markup needs form element template overrides."],
    },
    {
        id: "sitefinity",
        name: "Progress Sitefinity",
        category: "platform",
        match: [
            { kind: "generator", pattern: /Sitefinity/i, strength: "high" },
            { kind: "script", pattern: /Telerik\.Sitefinity|\/ResourcePackages\//i, strength: "medium" },
        ],
        version: [{ from: "generator", pattern: /Sitefinity ([\d.]+)/i }],
        fixLayer: "template",
        notes: ["Fix widget templates in the ResourcePackages folder; built-in widgets need template overrides."],
    },
    {
        id: "kentico",
        name: "Kentico Xperience",
        category: "platform",
        match: [
            { kind: "generator", pattern: /Kentico/i, strength: "high" },
            { kind: "script", pattern: /\/CMSPages\/GetResource\.ashx|\/CMSScripts\//i, strength: "high" },
            { kind: "cookie", pattern: /^(CMSPreferredCulture|CMSCsrfCookie|CMSCookieLevel)$/, strength: "high" },
        ],
        fixLayer: "template",
        notes: ["Fix page templates and widgets in the site's own code; built-in web parts need transformations or overrides."],
    },
    {
        id: "umbraco",
        name: "Umbraco",
        category: "platform",
        match: [
            { kind: "generator", pattern: /Umbraco/i, strength: "high" },
            { kind: "script", pattern: /\/umbraco\//i, strength: "medium" },
        ],
        fixLayer: "template",
        notes: ["Umbraco templates are the site's own Razor views; fix them there."],
    },
    {
        id: "wix",
        name: "Wix",
        category: "platform",
        match: [
            { kind: "generator", pattern: /Wix\.com/i, strength: "high" },
            { kind: "header", name: "x-wix-request-id", strength: "high" },
            { kind: "script", pattern: /static\.parastorage\.com/i, strength: "medium" },
        ],
        fixLayer: "vendor",
        notes: ["Wix renders the page markup. Fix what the editor's settings allow (labels, alt text, heading levels); the rest needs Wix itself or Velo custom code."],
    },
    {
        id: "squarespace",
        name: "Squarespace",
        category: "platform",
        match: [
            { kind: "header", name: "server", value: /Squarespace/i, strength: "high" },
            { kind: "script", pattern: /(static1|assets)\.squarespace\.com/i, strength: "medium" },
            { kind: "global", name: "Squarespace", strength: "medium" },
        ],
        fixLayer: "vendor",
        notes: ["Squarespace renders the page markup. Fix what block and site settings allow; the rest needs Squarespace or code injection."],
    },
    {
        id: "shopify",
        name: "Shopify",
        category: "platform",
        match: [
            { kind: "header", name: "x-shopid", strength: "high" },
            { kind: "header", name: "x-shopify-stage", strength: "high" },
            { kind: "global", name: "Shopify", strength: "medium" },
            { kind: "script", pattern: /cdn\.shopify\.com/i, strength: "medium" },
        ],
        fixLayer: "template",
        notes: ["Fix the theme's Liquid templates and sections; app-injected widgets need the app vendor."],
    },
    {
        id: "webflow",
        name: "Webflow",
        category: "platform",
        match: [
            { kind: "generator", pattern: /Webflow/i, strength: "high" },
            { kind: "selector", selector: "html[data-wf-page]", strength: "high" },
            { kind: "script", pattern: /webflow\.[a-z0-9]*\.?js|assets\.website-files\.com/i, strength: "medium" },
        ],
        fixLayer: "native",
        notes: ["Webflow exposes element tags and attributes in the Designer; most fixes are made there. Built-in components (sliders, tabs) need custom attributes or replacement."],
    },
    // ── Frameworks ─────────────────────────────────────────────────────────
    {
        id: "react",
        name: "React",
        category: "framework",
        match: [
            { kind: "probe", key: "reactDom", strength: "high" },
            { kind: "probe", key: "react", strength: "high" },
            { kind: "selector", selector: "[data-reactroot]", strength: "medium" },
        ],
        version: [{ from: "probe", key: "react" }],
        fixLayer: "custom-component",
        notes: ["Markup comes from the site's own React components (or a component library); fix it in the component source."],
    },
    {
        id: "react-router",
        name: "React Router (framework mode)",
        category: "framework",
        match: [
            { kind: "global", name: "__reactRouterContext", strength: "high" },
            { kind: "inline", pattern: /window\.__reactRouterContext\s*=/, strength: "high" },
        ],
        implies: ["react"],
        fixLayer: "custom-component",
        notes: ["Route components are the site's own code; fix markup there. Check focus management on client-side navigation."],
    },
    {
        id: "remix",
        name: "Remix",
        category: "framework",
        match: [
            { kind: "global", name: "__remixContext", strength: "high" },
            { kind: "inline", pattern: /window\.__remixContext\s*=/, strength: "high" },
        ],
        implies: ["react"],
        fixLayer: "custom-component",
    },
    {
        id: "nextjs",
        name: "Next.js",
        category: "framework",
        match: [
            { kind: "global", name: "__NEXT_DATA__", strength: "high" },
            { kind: "selector", selector: "script#__NEXT_DATA__", strength: "high" },
            { kind: "script", pattern: /\/_next\/static\//, strength: "high" },
            { kind: "selector", selector: "#__next", strength: "medium" },
        ],
        version: [{ from: "probe", key: "next" }],
        implies: ["react"],
        fixLayer: "custom-component",
        notes: ["Pages and components are the site's own code. Next.js route changes need focus and announcement handling."],
    },
    {
        id: "gatsby",
        name: "Gatsby",
        category: "framework",
        match: [
            { kind: "selector", selector: "#___gatsby", strength: "high" },
            { kind: "generator", pattern: /Gatsby/i, strength: "high" },
        ],
        version: [{ from: "generator", pattern: /Gatsby ([\d.]+)/i }],
        implies: ["react"],
        fixLayer: "custom-component",
    },
    {
        id: "angular",
        name: "Angular",
        category: "framework",
        match: [{ kind: "selector", selector: "[ng-version]", strength: "high" }],
        version: [{ from: "attr", selector: "[ng-version]", attr: "ng-version" }],
        fixLayer: "custom-component",
        notes: ["Fix component templates; Angular CDK a11y utilities cover focus traps and live announcements."],
    },
    {
        id: "vue",
        name: "Vue",
        category: "framework",
        match: [
            { kind: "probe", key: "vue", strength: "high" },
            { kind: "selector", selector: "[data-v-app]", strength: "high" },
            { kind: "global", name: "Vue", strength: "medium" },
        ],
        version: [{ from: "probe", key: "vue" }],
        fixLayer: "custom-component",
    },
    {
        id: "nuxt",
        name: "Nuxt",
        category: "framework",
        match: [
            { kind: "global", name: "__NUXT__", strength: "high" },
            { kind: "selector", selector: "#__nuxt", strength: "high" },
            { kind: "script", pattern: /\/_nuxt\//, strength: "medium" },
        ],
        implies: ["vue"],
        fixLayer: "custom-component",
    },
    {
        id: "svelte",
        name: "Svelte",
        category: "framework",
        match: [{ kind: "selector", selector: "[class*='svelte-']", strength: "medium" }],
        fixLayer: "custom-component",
    },
    {
        id: "sveltekit",
        name: "SvelteKit",
        category: "framework",
        match: [
            { kind: "inline", pattern: /__sveltekit_/, strength: "high" },
            { kind: "script", pattern: /\/_app\/immutable\//, strength: "high" },
        ],
        implies: ["svelte"],
        fixLayer: "custom-component",
    },
    {
        id: "astro",
        name: "Astro",
        category: "framework",
        match: [
            { kind: "generator", pattern: /Astro/i, strength: "high" },
            { kind: "selector", selector: "astro-island", strength: "high" },
        ],
        version: [{ from: "generator", pattern: /Astro v?([\d.]+)/i }],
        fixLayer: "custom-component",
    },
    {
        id: "aspnet-webforms",
        name: "ASP.NET Web Forms",
        category: "framework",
        match: [
            { kind: "selector", selector: "input[name='__VIEWSTATE']", strength: "high" },
            { kind: "script", pattern: /\/(WebResource|ScriptResource)\.axd/i, strength: "medium" },
            { kind: "header", name: "x-aspnet-version", strength: "medium" },
        ],
        version: [{ from: "header", name: "x-aspnet-version" }],
        fixLayer: "template",
        notes: [
            "Web Forms server controls (GridView, Menu, validators, UpdatePanel) generate their own markup and IDs. Fix them through control properties, adapters or replacement; page markup around them is the site's own.",
            "Every form post reloads or partially updates the page; check focus and announcements after postbacks.",
        ],
    },
    // ── UI libraries and widgets ──────────────────────────────────────────
    {
        id: "bootstrap",
        name: "Bootstrap",
        category: "ui-library",
        match: [
            { kind: "probe", key: "bootstrap", strength: "high" },
            { kind: "script", pattern: /bootstrap(\.bundle)?(\.min)?\.js/i, strength: "medium" },
            { kind: "stylesheet", pattern: /bootstrap(\.min)?\.css/i, strength: "medium" },
        ],
        version: [
            { from: "probe", key: "bootstrap" },
            { from: "script", pattern: /bootstrap[/@-](\d+\.\d+\.\d+)/i },
            { from: "stylesheet", pattern: /bootstrap[/@-](\d+\.\d+\.\d+)/i },
        ],
        fixLayer: "native",
        notes: ["Bootstrap components follow most ARIA patterns when used as documented; most defects come from how the site wires them. Bootstrap 3 and 4 are past end of life and receive no accessibility fixes."],
    },
    {
        id: "jquery",
        name: "jQuery",
        category: "ui-library",
        match: [
            { kind: "probe", key: "jquery", strength: "high" },
            { kind: "script", pattern: /\/jquery(-\d+\.\d+\.\d+)?(\.min)?\.js|\/jquery\/\d+\.\d+\.\d+\/jquery/i, strength: "medium" },
        ],
        version: [
            { from: "probe", key: "jquery" },
            { from: "script", pattern: /jquery[-/](\d+\.\d+\.\d+)/i },
        ],
        fixLayer: "native",
    },
    {
        id: "jquery-ui",
        name: "jQuery UI",
        category: "ui-library",
        match: [
            { kind: "probe", key: "jqueryUi", strength: "high" },
            { kind: "script", pattern: /jquery-ui(\.min)?\.js|\/jqueryui\/\d/i, strength: "medium" },
        ],
        version: [
            { from: "probe", key: "jqueryUi" },
            { from: "script", pattern: /jqueryui\/(\d+\.\d+\.\d+)/i },
        ],
        fixLayer: "custom-component",
        notes: ["jQuery UI widgets (datepicker, autocomplete, dialog) have known accessibility gaps and the project is in maintenance mode. Replace them, or patch and test each widget."],
    },
    {
        id: "liferay-clay",
        name: "Liferay Clay",
        category: "ui-library",
        match: [
            { kind: "stylesheet", pattern: /\/clay\.css|frontend-taglib-clay/i, strength: "high" },
        ],
        fixLayer: "native",
        notes: ["Clay is Liferay's Bootstrap-based component library. Clay components rendered by Liferay portlets need portlet or ADT overrides."],
    },
    {
        id: "alloyui",
        name: "AlloyUI / YUI 3",
        category: "ui-library",
        match: [
            { kind: "global", name: "AUI", strength: "high" },
            { kind: "stylesheet", pattern: /alloy_ui\.css|\/aui\//i, strength: "high" },
            { kind: "global", name: "YUI", strength: "medium" },
        ],
        version: [{ from: "probe", key: "yui", pattern: /(\d+\.\d+\.\d+)/ }],
        fixLayer: "vendor",
        notes: ["AlloyUI and YUI 3 are no longer developed (YUI ended in 2014). Markup they generate inside Liferay needs Liferay-level overrides."],
    },
    {
        id: "mui",
        name: "MUI (Material UI)",
        category: "ui-library",
        match: [{ kind: "selector", selector: "[class*='MuiButtonBase-root'], [class*='MuiBox-root'], [class*='MuiTypography-root']", strength: "medium" }],
        fixLayer: "custom-component",
    },
    {
        id: "chakra",
        name: "Chakra UI",
        category: "ui-library",
        match: [{ kind: "selector", selector: "[class*='chakra-']", strength: "medium" }],
        fixLayer: "custom-component",
    },
    {
        id: "antd",
        name: "Ant Design",
        category: "ui-library",
        match: [{ kind: "selector", selector: "[class*='ant-btn'], [class*='ant-layout'], [class*='ant-select']", strength: "medium" }],
        fixLayer: "custom-component",
    },
    {
        id: "slick",
        name: "Slick carousel",
        category: "widget",
        match: [
            { kind: "probe", key: "slick", strength: "medium" },
            { kind: "selector", selector: ".slick-slider", strength: "medium" },
            { kind: "script", pattern: /slick(\.min)?\.js/i, strength: "medium" },
        ],
        version: [{ from: "script", pattern: /slick-carousel[/@](\d+\.\d+\.\d+)/i }],
        fixLayer: "custom-component",
        notes: ["Slick hides off-screen slides from screen readers but leaves their links focusable, and has no pause control by default. Patch its settings and markup, or replace it with an accessible carousel."],
        attribution: [{ selector: ".slick-slider, .slick-slide, .slick-track, .slick-list", label: "Slick carousel" }],
    },
    {
        id: "bxslider",
        name: "bxSlider",
        category: "widget",
        match: [
            { kind: "probe", key: "bxslider", strength: "medium" },
            { kind: "selector", selector: ".bx-wrapper", strength: "medium" },
            { kind: "script", pattern: /bxslider/i, strength: "medium" },
        ],
        version: [{ from: "script", pattern: /bxslider\/(\d+\.\d+\.\d+)/i }],
        fixLayer: "custom-component",
        notes: ["bxSlider is unmaintained and has no keyboard or screen-reader support built in. Replace it."],
        attribution: [{ selector: ".bx-wrapper, .bx-viewport, .bx-pager, .bx-controls", label: "bxSlider" }],
    },
    {
        id: "swiper",
        name: "Swiper",
        category: "widget",
        match: [
            { kind: "global", name: "Swiper", strength: "medium" },
            { kind: "selector", selector: ".swiper, .swiper-container", strength: "medium" },
            { kind: "script", pattern: /swiper(-bundle)?(\.min)?\.js/i, strength: "medium" },
        ],
        fixLayer: "custom-component",
        notes: ["Swiper ships an a11y module that must be enabled and configured."],
        attribution: [{ selector: ".swiper, .swiper-container, .swiper-slide", label: "Swiper" }],
    },
    {
        id: "owl-carousel",
        name: "Owl Carousel",
        category: "widget",
        match: [
            { kind: "probe", key: "owl", strength: "medium" },
            { kind: "selector", selector: ".owl-carousel", strength: "medium" },
            { kind: "script", pattern: /owl\.carousel/i, strength: "medium" },
        ],
        fixLayer: "custom-component",
        notes: ["Owl Carousel is unmaintained and inaccessible by default. Replace it."],
        attribution: [{ selector: ".owl-carousel, .owl-item, .owl-nav, .owl-dots", label: "Owl Carousel" }],
    },
    {
        id: "selectboxit",
        name: "SelectBoxIt",
        category: "widget",
        match: [
            { kind: "probe", key: "selectboxit", strength: "medium" },
            { kind: "selector", selector: ".selectboxit-container", strength: "medium" },
            { kind: "script", pattern: /selectboxit/i, strength: "medium" },
        ],
        fixLayer: "custom-component",
        notes: ["SelectBoxIt replaces native selects with a custom widget and is unmaintained. Return to a native <select> where possible."],
        attribution: [{ selector: ".selectboxit-container, .selectboxit, .selectboxit-options", label: "SelectBoxIt" }],
    },
    {
        id: "select2",
        name: "Select2",
        category: "widget",
        match: [
            { kind: "probe", key: "select2", strength: "medium" },
            { kind: "selector", selector: ".select2-container", strength: "medium" },
            { kind: "script", pattern: /select2(\.full)?(\.min)?\.js/i, strength: "medium" },
        ],
        fixLayer: "custom-component",
        notes: ["Select2 has known screen-reader and labelling gaps. Test it with assistive technology or replace it with a native select or an APG combobox."],
        attribution: [{ selector: ".select2-container, .select2-selection, .select2-dropdown", label: "Select2" }],
    },
    {
        id: "chosen",
        name: "Chosen",
        category: "widget",
        match: [
            { kind: "probe", key: "chosen", strength: "medium" },
            { kind: "selector", selector: ".chosen-container", strength: "medium" },
            { kind: "script", pattern: /chosen\.jquery/i, strength: "medium" },
        ],
        fixLayer: "custom-component",
        notes: ["Chosen is unmaintained and not screen-reader accessible. Replace it."],
        attribution: [{ selector: ".chosen-container, .chosen-drop", label: "Chosen" }],
    },
    {
        id: "gsap",
        name: "GSAP",
        category: "ui-library",
        match: [
            { kind: "probe", key: "gsap", strength: "high" },
            { kind: "script", pattern: /\/(gsap|TweenMax|TweenLite)(\.min)?\.js/i, strength: "medium" },
        ],
        version: [{ from: "probe", key: "gsap" }],
        fixLayer: "custom-component",
        notes: ["Check that GSAP animations respect prefers-reduced-motion and that nothing auto-plays longer than 5 seconds without a pause control (WCAG 2.2.2)."],
    },
    // ── Overlays ───────────────────────────────────────────────────────────
    {
        id: "accessibe",
        name: "accessiBe",
        category: "overlay",
        match: [
            { kind: "script", pattern: /acsbapp?\.com/i, strength: "high" },
            { kind: "global", name: "acsbJS", strength: "high" },
            { kind: "selector", selector: "access-widget-ui", strength: "medium" },
            { kind: "selector", selector: "[data-acsb]", strength: "medium" },
        ],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
        attribution: [{ selector: "access-widget-ui, [data-acsb], [class*='acsb-']", label: "accessiBe overlay" }],
    },
    {
        id: "userway",
        name: "UserWay",
        category: "overlay",
        match: [
            { kind: "script", pattern: /cdn\.userway\.org/i, strength: "high" },
            { kind: "global", name: "UserWay", strength: "medium" },
        ],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
        attribution: [{ selector: "[class*='userway'], [id*='userway'], .uwy", label: "UserWay overlay" }],
    },
    {
        id: "audioeye",
        name: "AudioEye",
        category: "overlay",
        // Current installs load from wsv3cdn.audioeye-services.com (seen live on
        // stitchgolf.com, hunterpureair.com, hotchillys.com, 2026-11-18).
        match: [
            { kind: "script", pattern: /audioeye(-services)?\.com/i, strength: "high" },
            { kind: "selector", selector: "#ae_enabled_site", strength: "medium" },
        ],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
        attribution: [{ selector: "[id^='ae_'], [class^='ae-']", label: "AudioEye overlay" }],
    },
    {
        id: "equalweb",
        name: "EqualWeb",
        category: "overlay",
        match: [
            { kind: "script", pattern: /equalweb\.com|nagich/i, strength: "high" },
            { kind: "global", name: "interdeal", strength: "medium" },
        ],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
    },
    {
        id: "reciteme",
        name: "Recite Me",
        category: "overlay",
        match: [{ kind: "script", pattern: /reciteme\.com/i, strength: "high" }],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
    },
    {
        // Observed live on whirlpool.com (2026-11-17): a tabindex="1" link with
        // class "UsableNetAssistive" calling enableUsableNetAssistive().
        id: "usablenet",
        name: "UsableNet Assistive",
        category: "overlay",
        match: [
            { kind: "script", pattern: /usablenet\.(com|net)/i, strength: "high" },
            { kind: "selector", selector: ".UsableNetAssistive", strength: "high" },
            { kind: "selector", selector: "[onclick*='enableUsableNetAssistive']", strength: "high" },
            { kind: "global", name: "enableUsableNetAssistive", strength: "high" },
        ],
        fixLayer: "vendor",
        notes: [
            "UsableNet Assistive serves a separate, vendor-run version of the site when the user opts in. The default site that most users and assistive technology get is unchanged.",
            ...OVERLAY_NOTES,
        ],
        attribution: [{ selector: ".UsableNetAssistive, [class*='usablenet'], [id*='usablenet']", label: "UsableNet Assistive" }],
    },
    {
        id: "maxaccess",
        name: "Max Access",
        category: "overlay",
        match: [{ kind: "script", pattern: /maxaccess\.io/i, strength: "high" }],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
    },
    {
        id: "equally",
        name: "Equally AI",
        category: "overlay",
        match: [{ kind: "script", pattern: /equally\.ai/i, strength: "high" }],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
    },
    {
        id: "allyable",
        name: "Allyable",
        category: "overlay",
        match: [{ kind: "script", pattern: /allyable\.com/i, strength: "high" }],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
    },
    {
        id: "sitecues",
        name: "Sitecues",
        category: "overlay",
        match: [{ kind: "script", pattern: /sitecues\.com/i, strength: "high" }],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
    },
    {
        id: "essentialaccessibility",
        name: "eSSENTIAL Accessibility",
        category: "overlay",
        match: [{ kind: "script", pattern: /essentialaccessibility\.com/i, strength: "high" }],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
    },
    {
        id: "faciliti",
        name: "FACIL'iti",
        category: "overlay",
        match: [{ kind: "script", pattern: /facil-iti\./i, strength: "high" }],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
    },
    {
        // Shopify app by On The Map Marketing. Observed live on marshwearclothing.com
        // (2026-11-17), loaded from both hosts below.
        id: "accessibly",
        name: "Accessibly (On The Map Marketing)",
        category: "overlay",
        match: [{ kind: "script", pattern: /accessibly\.(apps\.)?onthemapmarketing\.com/i, strength: "high" }],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
    },
    {
        // Observed live on jonessoda.com (2026-11-17): api.allaccessible.org/widget/…
        id: "allaccessible",
        name: "AllAccessible",
        category: "overlay",
        match: [{ kind: "script", pattern: /(api|cdn)\.allaccessible\.org/i, strength: "high" }],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
    },
    {
        id: "pojo-a11y",
        name: "One Click Accessibility (WordPress toolbar)",
        category: "overlay",
        match: [
            { kind: "selector", selector: "#pojo-a11y-toolbar", strength: "high" },
            { kind: "script", pattern: /pojo-accessibility/i, strength: "high" },
        ],
        fixLayer: "vendor",
        notes: OVERLAY_NOTES,
    },
    {
        // Catch-all for overlays no named signature covers. Generic names alone
        // are weak evidence (a site's own accessibility.js is not an overlay), so
        // every matcher is low and the notes ask for a manual check. Dropped when
        // a named overlay is detected on the same page (see refine in stack.ts).
        id: "overlay-unrecognized",
        name: "Possible accessibility overlay (vendor not recognized)",
        category: "overlay",
        match: [
            { kind: "script", pattern: /(accessib\w*|a11y)[\w.\/-]*(widget|toolbar|overlay|plugin)/i, strength: "low" },
            { kind: "selector", selector: "[class*='accessibility-widget'], [id*='accessibility-widget'], [class*='a11y-widget'], [id*='a11y-widget']", strength: "low" },
            { kind: "selector", selector: "[class*='accessibility-toolbar'], [id*='accessibility-toolbar'], [class*='a11y-toolbar'], [id*='a11y-toolbar']", strength: "low" },
        ],
        fixLayer: "vendor",
        notes: [
            "Matched generic accessibility-widget names, not a known vendor. Confirm by hand whether this is a third-party overlay or the site's own code.",
            ...OVERLAY_NOTES,
        ],
    },
    // ── Other third parties ───────────────────────────────────────────────
    {
        id: "docaccess",
        name: "DocAccess",
        category: "document-accessibility",
        match: [{ kind: "script", pattern: /docaccess\.com/i, strength: "high" }],
        fixLayer: "vendor",
        notes: ["DocAccess converts documents for reading on request. It does not tag or fix the source PDFs, which still need remediation."],
    },
    {
        id: "qualtrics",
        name: "Qualtrics Site Intercept",
        category: "feedback",
        match: [
            { kind: "script", pattern: /siteintercept\.qualtrics\.com/i, strength: "high" },
            { kind: "global", name: "QSI", strength: "medium" },
        ],
        fixLayer: "vendor",
        notes: ["Intercept surveys and feedback buttons are configured in Qualtrics. Check their focus handling and labels there, or ask the vendor."],
        attribution: [{ selector: "[class*='QSI'], [id^='QSI']", label: "Qualtrics intercept" }],
    },
    {
        id: "dynatrace",
        name: "Dynatrace",
        category: "monitoring",
        match: [
            { kind: "script", pattern: /ruxitagentjs/i, strength: "high" },
            { kind: "header", name: "x-oneagent-js-injection", strength: "high" },
            { kind: "global", name: "dtrum", strength: "medium" },
            { kind: "cookie", pattern: /^dtCookie$/, strength: "medium" },
        ],
        fixLayer: "vendor",
    },
    {
        id: "gtm",
        name: "Google Tag Manager",
        category: "analytics",
        match: [
            { kind: "script", pattern: /googletagmanager\.com\/gtm\.js/i, strength: "high" },
            { kind: "global", name: "google_tag_manager", strength: "low" },
        ],
        fixLayer: "vendor",
        notes: ["Tags injected through GTM (chat widgets, banners, surveys) are site-managed. Audit them in GTM, not in page templates."],
    },
    {
        id: "youtube",
        name: "YouTube embed",
        category: "media",
        match: [
            { kind: "selector", selector: "iframe[src*='youtube.com/embed'], iframe[src*='youtube-nocookie.com/embed']", strength: "high" },
            { kind: "script", pattern: /youtube\.com\/iframe_api/i, strength: "medium" },
        ],
        fixLayer: "vendor",
        notes: ["Player controls belong to YouTube. The site must give each embed a title and provide captions and, where needed, audio description."],
        attribution: [{ selector: "iframe[src*='youtube']", label: "YouTube embed" }],
    },
];
/** SharePoint on-premises build → product mapping (major.minor.build). */
export function sharePointProduct(version) {
    const m = version.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!m)
        return { name: "Microsoft SharePoint Server", id: "unknown" };
    const major = Number(m[1]);
    const build = Number(m[3]);
    if (major === 15)
        return { name: "Microsoft SharePoint Server 2013", id: "2013" };
    if (major === 16) {
        if (build >= 20000)
            return { name: "Microsoft SharePoint Online", id: "online" };
        if (build >= 14000)
            return { name: "Microsoft SharePoint Server Subscription Edition", id: "se" };
        if (build >= 10000)
            return { name: "Microsoft SharePoint Server 2019", id: "2019" };
        if (build >= 4000)
            return { name: "Microsoft SharePoint Server 2016", id: "2016" };
    }
    return { name: "Microsoft SharePoint Server", id: "unknown" };
}
export const SHAREPOINT_LIFECYCLE = {
    "2016": {
        status: "Extended support ended. Microsoft no longer issues security or accessibility fixes.",
        date: "2026-07-14",
        asOf: AS_OF,
        source: "https://learn.microsoft.com/en-us/lifecycle/products/sharepoint-server-2016",
    },
    "2019": {
        status: "Extended support ended. Microsoft no longer issues security or accessibility fixes.",
        date: "2026-07-14",
        asOf: AS_OF,
        source: "https://learn.microsoft.com/en-us/lifecycle/products/sharepoint-server-2019",
    },
};
