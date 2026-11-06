export function referralCouponMatchesContract(
  coupon,
  percent,
  coreProductId,
) {
  const appliesTo =
    coupon?.applies_to &&
    typeof coupon.applies_to === "object" &&
    !Array.isArray(coupon.applies_to)
      ? coupon.applies_to
      : null;
  const products = Array.isArray(appliesTo?.products)
    ? appliesTo.products.filter((value) => typeof value === "string")
    : [];
  return coupon?.valid !== false &&
    coupon?.duration === "forever" &&
    coupon?.percent_off === percent &&
    products.length === 1 &&
    products[0] === coreProductId;
}
