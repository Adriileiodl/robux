// Painel do dono: aprovar entrega ou cancelar um pedido pago
const { adminOnly } = require("../../lib/http");
const { getOrder, transition, release } = require("../../lib/orders");
const { cmd } = require("../../lib/redis");

module.exports = async (req, res) => {
  if (!adminOnly(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });
  try {
    const { id, action } = req.body || {};
    const o = await getOrder(id);
    if (!o) return res.status(404).json({ error: "Pedido nao encontrado." });

    if (action === "aprovar") {
      if (!(await transition(id, "entregue", ["pago_aguardando_aprovacao", "pago_sem_estoque"]))) {
        return res.status(409).json({ error: "Esse pedido nao esta aguardando aprovacao." });
      }
      await cmd("HSET", `order:${id}`, "deliveredAt", String(Date.now()));
      return res.status(200).json({ ok: true });
    }

    if (action === "cancelar") {
      // Cancelar um pedido pago devolve os ROBUX ao estoque (o reembolso do Pix e feito por voce no app do Inter)
      if (await transition(id, "cancelado", ["pago_aguardando_aprovacao"])) {
        await release(o.qty);
        return res.status(200).json({ ok: true });
      }
      if (await transition(id, "cancelado", ["pago_sem_estoque"])) return res.status(200).json({ ok: true });
      return res.status(409).json({ error: "So da para cancelar pedidos pagos que ainda nao foram entregues." });
    }

    res.status(400).json({ error: "Acao invalida." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao executar a acao." });
  }
};
