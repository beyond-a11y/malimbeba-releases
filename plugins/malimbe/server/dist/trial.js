// Local licensing is a courtesy gate, not DRM: the package is inspectable and copyable.
import { verify } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const EVAL_DAYS = 30;
const PRODUCT_ID = "malimbeba";
const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA6KYt9e/ps3oaDkJVL8RZNzCNt4nYi1G8yUdfz7+FVSU=
-----END PUBLIC KEY-----`;
function configDir() {
    return process.env.MALIMBEBA_CONFIG_DIR?.trim() || join(homedir(), ".malimbeba");
}
function savedLicenseCode(directory) {
    try {
        return readFileSync(join(directory, "license-key"), "utf8").trim() || undefined;
    }
    catch {
        return undefined;
    }
}
function firstRunTimestamp(directory, now) {
    const file = join(directory, "first-run");
    try {
        const value = Number(readFileSync(file, "utf8").trim());
        return Number.isFinite(value) && value > 0 ? value : now;
    }
    catch {
        try {
            mkdirSync(directory, { recursive: true });
            writeFileSync(file, String(now), "utf8");
        }
        catch {
            /* A read-only filesystem cannot persist the local evaluation start. */
        }
        return now;
    }
}
const DAY_MS = 86_400_000;
function activationRecord(directory) {
    try {
        const parsed = JSON.parse(readFileSync(join(directory, "license-activation.json"), "utf8"));
        return Number.isSafeInteger(parsed.acceptedAt) ? parsed : undefined;
    }
    catch {
        return undefined;
    }
}
function recordActivation(directory, licenseId, acceptedAt) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "license-activation.json"), JSON.stringify({ licenseId, acceptedAt }), "utf8");
}
function acceptanceTime(directory, license, now) {
    const existing = activationRecord(directory);
    if (existing && existing.licenseId === license.licenseId)
        return existing.acceptedAt;
    try {
        recordActivation(directory, license.licenseId, now);
    }
    catch {
        /* A read-only filesystem cannot persist the acceptance time; the term then counts from this check. */
    }
    return now;
}
export function verifyLicenseCode(code, options = {}) {
    const parts = code.trim().split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return { valid: false, reason: "The validation code format is invalid." };
    }
    try {
        const [payloadPart, signaturePart] = parts;
        const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
        const signature = Buffer.from(signaturePart, "base64url");
        const publicKey = options.publicKey ?? LICENSE_PUBLIC_KEY;
        if (!verify(null, Buffer.from(payloadPart), publicKey, signature)) {
            return { valid: false, reason: "The validation code signature is not valid." };
        }
        if (payload.product !== PRODUCT_ID || typeof payload.licenseId !== "string" || !payload.licenseId) {
            return { valid: false, reason: "The validation code is for a different product or is incomplete." };
        }
        if (!Number.isSafeInteger(payload.issuedAt) || payload.issuedAt > (options.now ?? Date.now()) + 300_000) {
            return { valid: false, reason: "The validation code issue date is invalid." };
        }
        if (payload.expiresAt !== undefined && (!Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= payload.issuedAt)) {
            return { valid: false, reason: "The validation code term is invalid." };
        }
        return { valid: true, license: payload };
    }
    catch {
        return { valid: false, reason: "The validation code could not be verified." };
    }
}
export function getEntitlement(options = {}) {
    const now = options.now ?? Date.now();
    const directory = options.directory ?? configDir();
    const code = options.licenseCode?.trim() || process.env.MALIMBEBA_LICENSE_KEY?.trim() || savedLicenseCode(directory);
    // The trial clock starts at first use in every case, with or without a code. If it only started
    // once no code was valid, a time-limited code would be followed by a fresh 30-day trial.
    const started = firstRunTimestamp(directory, now);
    let codeProblem;
    if (code) {
        const verification = verifyLicenseCode(code, { now, publicKey: options.publicKey });
        if (verification.valid && verification.license) {
            const license = verification.license;
            if (license.expiresAt === undefined) {
                return { allowed: true, licensed: true, remainingDays: 0, message: "Paid license validated.", license };
            }
            const termEnds = acceptanceTime(directory, license, now) + (license.expiresAt - license.issuedAt);
            if (now < termEnds) {
                const termDays = Math.ceil((termEnds - now) / DAY_MS);
                return {
                    allowed: true,
                    licensed: true,
                    remainingDays: termDays,
                    message: `Paid license validated: ${termDays} day${termDays === 1 ? "" : "s"} left in your term.`,
                    license,
                };
            }
            codeProblem = "The paid license term has ended.";
        }
        else {
            codeProblem = verification.reason;
        }
    }
    const elapsedDays = Math.floor((now - started) / DAY_MS);
    const remainingDays = EVAL_DAYS - elapsedDays;
    const invalidCode = codeProblem ? ` Validation code not accepted: ${codeProblem}` : "";
    const message = remainingDays > 0
        ? `Malimbe by Beyond-A11y — 30-day beta: ${remainingDays} day${remainingDays === 1 ? "" : "s"} left.${invalidCode} A paid validation code is required after the beta. https://github.com/beyond-a11y/malimbeba-releases`
        : `Malimbe by Beyond-A11y — the 30-day beta has ended. Activate a paid validation code to continue.${invalidCode} https://beyond-a11y.com`;
    return { allowed: remainingDays > 0, licensed: false, remainingDays, message };
}
export function activateLicenseCode(code, options = {}) {
    const verification = verifyLicenseCode(code, { publicKey: options.publicKey, now: options.now });
    if (!verification.valid)
        return { valid: false, message: verification.reason ?? "The validation code is not valid." };
    try {
        const directory = options.directory ?? configDir();
        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, "license-key"), code.trim(), "utf8");
        recordActivation(directory, verification.license.licenseId, options.now ?? Date.now());
        return { valid: true, message: "Validation code activated for this user account." };
    }
    catch {
        return { valid: false, message: "Could not save the validation code. Check folder permissions and try again." };
    }
}
