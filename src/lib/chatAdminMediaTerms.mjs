// Monetary values remain exclusively in the existing Character offers.
// This metadata binds those offers to catalogue products, units and tax display.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export function normalizeMediaTerms(value) {
  const fail=()=>{throw Error("invalid_media_terms");};
  const keys=["scope","target_id","kind","quantity","inherit","upper_unlimited","negotiation_allowed","special_discounts_allowed","tax_mode","vat_basis_points","unit_seconds"];
  if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail();
  if(!["folder","file","model"].includes(value.scope)||!["image","video"].includes(value.kind))fail();
  if(value.scope==="model"?value.target_id!==null:!uuid.test(value.target_id))fail();
  if(!Number.isSafeInteger(value.quantity)||value.quantity<1||value.quantity>100||value.scope==="file"&&value.quantity!==1)fail();
  for(const key of ["inherit","upper_unlimited","negotiation_allowed","special_discounts_allowed"])if(typeof value[key]!=="boolean")fail();
  if(!["unconfirmed","vat_included","vat_exempt"].includes(value.tax_mode))fail();
  if(value.tax_mode==="vat_included"?(!Number.isSafeInteger(value.vat_basis_points)||value.vat_basis_points<0||value.vat_basis_points>10000):value.vat_basis_points!==null)fail();
  if(value.unit_seconds!==null&&(!Number.isSafeInteger(value.unit_seconds)||value.unit_seconds<1||value.unit_seconds>300||value.kind!=="video"||value.quantity!==1))fail();
  return Object.fromEntries(keys.map(k=>[k,value[k]]));
}
export function mediaPriceFloor(offer) {
  return Math.max(offer.minimumPriceMinor,Number((BigInt(offer.recommendedPriceMinor)*BigInt(100-offer.maximumDiscountPercent)+99n)/100n));
}
export function mediaTaxBreakdown(offer,amount=offer.recommendedPriceMinor) {
  const terms=offer.mediaTerms;
  if(!terms||terms.tax_mode==="unconfirmed")return null;
  const vat=terms.tax_mode==="vat_included"?Number((BigInt(amount)*BigInt(terms.vat_basis_points)*2n+BigInt(10000+terms.vat_basis_points))/(BigInt(10000+terms.vat_basis_points)*2n)):0;
  return {currency:offer.currency,gross_minor:amount,net_minor:amount-vat,vat_minor:vat,mode:terms.tax_mode,vat_basis_points:terms.vat_basis_points};
}
