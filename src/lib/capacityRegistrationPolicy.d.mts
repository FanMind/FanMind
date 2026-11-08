export type CapacityRegistrationPackageId = "capacity_99" | "capacity_199" | "capacity_312";
export function isCapacityRegistrationPackage(value: unknown): value is CapacityRegistrationPackageId;
export function resolveCapacityRegistrationPackage(value: unknown): CapacityRegistrationPackageId;
export function capacityRegistrationPackages(language?: string): Array<{
  id: CapacityRegistrationPackageId; name: string; price: string; setup: string; status: string;
}>;
export function capacityRegistrationHref(input?: {
  packageId?: unknown; language?: string; referralCode?: string;
}): string;
export function capacityLandingPlans(language?: string): Array<{
  icon: string; name: string; eyebrow: string; audience: string; pricePrefix: string;
  price: string; cadence: string; cta: string; href: string; tone: string;
  featured: boolean; status: string; features: string[];
}>;

export function capacityDataPackages(language?: string): Array<{id: string; name: string; price: string; type: string}>;
export function capacityPricingKnowledge(): string;
