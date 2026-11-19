#!/usr/bin/env node
import { activateLicenseCode, getEntitlement } from "./trial.js";
const [command, code] = process.argv.slice(2);
if (command === "activate" && code) {
    const result = activateLicenseCode(code);
    console.log(result.message);
    process.exitCode = result.valid ? 0 : 1;
}
else if (command === "status") {
    const entitlement = getEntitlement();
    console.log(entitlement.message);
    process.exitCode = entitlement.allowed ? 0 : 1;
}
else {
    console.error("Usage: malimbeba-license activate <validation-code> | status");
    process.exitCode = 2;
}
