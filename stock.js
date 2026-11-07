// Painel do dono: define o estoque manualmente (ex.: ao repor ROBUX)
const { adminOnly } = require("../../lib/http");
const { setStock, getStock } = require("../../lib/orders");

module.exports = async (req, res) => {
  if (!adminOnly(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });
  try {
    const n = Number((req.body || {}).stock);
    if (!Number.isInteger(n) || n < 0 || n > 100000000) return res.status(400).json({ error: "Estoque invalido." });
    await setStock(n);
    res.status(200).json({ stock: await getStock() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao atualizar o estoque." });
  }
};
