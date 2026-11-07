// Cria o pedido: valida, reserva o estoque e gera o Pix no Banco Inter
const cfg = require("../lib/config");
const inter = require("../lib/inter");
const { calcTotals, centsToDecimal } = require("../lib/pricing");
const { reserve, release, createOrder, getOrder, publicOrder, sweepExpired } = require("../lib/orders");
const { rateLimit } = require("../lib/http");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });
  try {
    const { qty, nick, coupon } = req.body || {};
    const q = Number(qty);
    const nickname = String(nick || "").trim();

    if (!Number.isInteger(q) || q < cfg.MIN_QTY) return res.status(400).json({ error: `A quantidade minima e ${cfg.MIN_QTY} ROBUX.` });
    if (q > 1000000) return res.status(400).json({ error: "Quantidade invalida." });
    if (!/^[A-Za-z0-9_]{3,20}$/.test(nickname)) return res.status(400).json({ error: "Nick invalido (3 a 20 caracteres: letras, numeros e _)." });

    const t = calcTotals(q, coupon);
    if (coupon && String(coupon).trim() && !t.coupon) return res.status(400).json({ error: "Cupom invalido." });

    if (!(await rateLimit(req, "checkout", 8, 900))) return res.status(429).json({ error: "Muitos pedidos em pouco tempo. Tente novamente em alguns minutos." });

    try { await sweepExpired(); } catch (e) { console.error("sweep:", e.message); }

    if (!(await reserve(q))) return res.status(409).json({ error: "Estoque insuficiente para essa quantidade." });

    const id = inter.newTxid();
    let cob;
    try {
      cob = await inter.createCob({
        txid: id,
        valor: centsToDecimal(t.totalCents),
        expiracao: cfg.HOLD_SECONDS,
        descricao: `${q} ROBUX para ${nickname}`,
      });
    } catch (e) {
      await release(q);
      console.error("createCob:", e.message);
      return res.status(502).json({ error: "Nao foi possivel gerar o Pix agora. Tente novamente em instantes." });
    }

    const now = Date.now();
    try {
      await createOrder({
        id,
        status: "aguardando_pagamento",
        nick: nickname,
        qty: q,
        coupon: t.coupon ? t.coupon.code : "",
        couponPct: t.coupon ? t.coupon.pct : 0,
        subtotalCents: t.subtotalCents,
        discountCents: t.discountCents,
        totalCents: t.totalCents,
        pix: cob.pixCopiaECola,
        createdAt: now,
        pixExpiresAt: now + cfg.HOLD_SECONDS * 1000,
        expiresAt: now + (cfg.HOLD_SECONDS + 30) * 1000, // folga para pagamentos no ultimo segundo
      });
    } catch (e) {
      await release(q);
      throw e;
    }

    res.status(200).json({ order: publicOrder(await getOrder(id)) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao criar o pedido." });
  }
};
