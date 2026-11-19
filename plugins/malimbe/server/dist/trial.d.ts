export interface LicensePayload {
    product: string;
    licenseId: string;
    issuedAt: number;
    expiresAt?: number;
    plan?: string;
    seats?: number;
}
export interface Entitlement {
    allowed: boolean;
    licensed: boolean;
    remainingDays: number;
    message: string;
    license?: LicensePayload;
}
export declare function verifyLicenseCode(code: string, options?: {
    now?: number;
    publicKey?: string;
}): {
    valid: boolean;
    reason?: string;
    license?: LicensePayload;
};
export declare function getEntitlement(options?: {
    now?: number;
    licenseCode?: string;
    publicKey?: string;
    directory?: string;
}): Entitlement;
export declare function activateLicenseCode(code: string, options?: {
    directory?: string;
    publicKey?: string;
    now?: number;
}): {
    valid: boolean;
    message: string;
};
