// Consulta o status de um pedido (o codigo do pedido e secreto e impossivel de adivinhar)
const { refresh, publicOrder, getOrder } = require("../lib/orders");
const { rateLimit } = require("../lib/http");

module.exports = async (req, res) => {
  try {
    if (!(await rateLimit(req, "order", 240, 600))) return res.status(429).json({ error: "Muitas consultas. Aguarde um pouco." });
    const id = String((req.query && req.query.id) || "");
    let o = await getOrder(id);
    if (!o) return res.status(404).json({ error: "Pedido nao encontrado." });
    try {
      o = (await refresh(id)) || o;
    } catch (e) {
      console.error("refresh:", e.message);
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ order: publicOrder(o) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao consultar o pedido." });
  }
};
