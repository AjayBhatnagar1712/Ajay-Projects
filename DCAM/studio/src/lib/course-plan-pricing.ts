export type CourseCoupon = {
  code: string;
  discountAmount: number;
  finalPrice: number;
  discountPercent: number;
};

type CourseCouponLike = {
  code?: string | null;
  couponCode?: string | null;
  discountAmount?: number | null;
  finalPrice?: number | null;
  discountPercent?: number | null;
};

type CoursePlanLike = {
  price?: number | null;
  oneTimePrice?: number | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
  couponCode?: string | null;
  courseCoupons?: CourseCouponLike[] | null;
};

const sanitizeAmount = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
};

export const normalizeCouponCode = (value?: string | null) => String(value || '').trim().toUpperCase();

export const resolveCourseBasePrice = (
  plan?: Pick<CoursePlanLike, 'price' | 'oneTimePrice'> | null
) => {
  const configuredBasePrice = sanitizeAmount(plan?.oneTimePrice);
  if (configuredBasePrice > 0) return configuredBasePrice;
  return sanitizeAmount(plan?.price);
};

const buildCouponFromRaw = (basePrice: number, raw: CourseCouponLike) => {
  const code = normalizeCouponCode(raw.code ?? raw.couponCode);
  if (!code || basePrice <= 0) return null;

  const discountAmount = Math.min(sanitizeAmount(raw.discountAmount), basePrice);
  if (discountAmount <= 0) return null;

  const finalPrice = Math.max(0, Number((basePrice - discountAmount).toFixed(2)));
  const discountPercent = Number(((discountAmount / basePrice) * 100).toFixed(2));

  return {
    code,
    discountAmount,
    finalPrice,
    discountPercent,
  } satisfies CourseCoupon;
};

export const resolveCourseCoupons = (plan?: CoursePlanLike | null) => {
  const basePrice = resolveCourseBasePrice(plan);
  if (basePrice <= 0) return [] as CourseCoupon[];

  const directCoupons = Array.isArray(plan?.courseCoupons)
    ? plan.courseCoupons
      .map((coupon) => buildCouponFromRaw(basePrice, coupon))
      .filter((coupon): coupon is CourseCoupon => !!coupon)
    : [];

  const couponMap = new Map<string, CourseCoupon>();
  directCoupons.forEach((coupon) => {
    if (!couponMap.has(coupon.code)) {
      couponMap.set(coupon.code, coupon);
    }
  });

  if (couponMap.size > 0) {
    return Array.from(couponMap.values()).sort((left, right) => left.code.localeCompare(right.code));
  }

  const legacyCoupon = buildCouponFromRaw(basePrice, {
    couponCode: plan?.couponCode,
    discountAmount: plan?.discountAmount,
    finalPrice: plan?.price,
    discountPercent: plan?.discountPercent,
  });

  return legacyCoupon ? [legacyCoupon] : [];
};

export const resolveCourseCouponByCode = (plan: CoursePlanLike | null | undefined, couponCode?: string | null) => {
  const normalizedCode = normalizeCouponCode(couponCode);
  if (!normalizedCode) return null;
  return resolveCourseCoupons(plan).find((coupon) => coupon.code === normalizedCode) || null;
};

export const pickCoursePlanForPublicDisplay = <T extends CoursePlanLike>(plans?: T[] | null) => {
  const validPlans = (plans || []).filter((plan) => resolveCourseBasePrice(plan) > 0);
  if (validPlans.length === 0) return null;

  return validPlans.reduce((selectedPlan, currentPlan) => (
    resolveCourseBasePrice(currentPlan) > resolveCourseBasePrice(selectedPlan) ? currentPlan : selectedPlan
  ));
};
