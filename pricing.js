// Calculo de precos SEMPRE em centavos inteiros (evita erro de arredondamento)
const cfg = require("./config");

function findCoupon(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  if (!c || cfg.COUPONS[c] === undefined) return null;
  return { code: c, pct: cfg.COUPONS[c] };
}

function calcTotals(qty, couponCode, priceCents = cfg.PRICE_CENTS_PER_ROBUX) {
  const subtotalCents = qty * priceCents;
  const coupon = findCoupon(couponCode);
  const discountCents = coupon ? Math.round((subtotalCents * coupon.pct) / 100) : 0;
  const totalCents = Math.max(subtotalCents - discountCents, 1);
  return { subtotalCents, discountCents, totalCents, coupon };
}

function centsToDecimal(cents) {
  return (cents / 100).toFixed(2);
}

module.exports = { findCoupon, calcTotals, centsToDecimal };
