// Valida um cupom (so informa se e valido e o percentual)
const { findCoupon } = require("../lib/pricing");
const { rateLimit } = require("../lib/http");

module.exports = async (req, res) => {
  try {
    if (!(await rateLimit(req, "coupon", 30, 600))) return res.status(429).json({ error: "Muitas tentativas. Aguarde um pouco." });
    const c = findCoupon(req.query && req.query.code);
    if (!c) return res.status(200).json({ valid: false });
    res.status(200).json({ valid: true, code: c.code, pct: c.pct });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao validar o cupom." });
  }
};
