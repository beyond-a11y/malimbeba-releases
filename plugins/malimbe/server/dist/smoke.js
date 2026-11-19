import { auditHtml } from "./engine/audit.js";
import { auditToMarkdown } from "./format.js";
import { contrastRatio, parseColor } from "./engine/contrast.js";
const bad = `
<html>
  <body>
    <img src="logo.png">
    <input type="text" id="email">
    <label for="ghost">Nope</label>
    <button></button>
    <a href="/next"></a>
    <h1>Title</h1>
    <h3>Skipped</h3>
    <div role="buton">typo</div>
    <span tabindex="3">x</span>
    <p style="color:#aaa; background-color:#fff">low contrast</p>
    <div aria-hidden="true"><a href="/x">still focusable</a></div>
  </body>
</html>`;
const result = auditHtml(bad);
console.log(auditToMarkdown(result));
console.log("\n--- counts ---");
console.log(JSON.stringify(result.summary, null, 2));
// Sanity-check the contrast math against a known pair.
const black = parseColor("#000000");
const white = parseColor("#ffffff");
console.log("\nblack/white ratio:", contrastRatio(black, white).toFixed(2), "(expected 21.00)");
const clean = `<html lang="en"><body><img src="a.png" alt="A logo"><h1>Ok</h1></body></html>`;
console.log("\nclean doc passed:", auditHtml(clean).summary.passed);
