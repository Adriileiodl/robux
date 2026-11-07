// Painel do dono: lista pedidos e estoque
const { adminOnly } = require("../../lib/http");
const { getStock, listOrders, refresh, sweepExpired } = require("../../lib/orders");

module.exports = async (req, res) => {
  if (!adminOnly(req, res)) return;
  try {
    try { await sweepExpired(); } catch (e) { console.error("sweep:", e.message); }
    let orders = await listOrders(100);

    // Confere no Inter os pedidos ainda aguardando pagamento (rede de seguranca caso o webhook falhe)
    const pend = orders.filter((o) => o.status === "aguardando_pagamento").slice(0, 10);
    let changed = false;
    for (const o of pend) {
      try {
        const n = await refresh(o.id);
        if (n && n.status !== o.status) changed = true;
      } catch (e) { console.error(e.message); }
    }
    if (changed) orders = await listOrders(100);

    const stock = await getStock();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      stock,
      orders: orders.map(({ pix, ...rest }) => rest),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao carregar pedidos." });
  }
};
