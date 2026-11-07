// Painel do dono: registra no Banco Inter a URL que recebe o aviso de pagamento
const { adminOnly } = require("../../lib/http");
const inter = require("../../lib/inter");

module.exports = async (req, res) => {
  if (!adminOnly(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo nao permitido." });
  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const base = (process.env.SITE_URL || `https://${host}`).replace(/\/$/, "");
    const url = `${base}/api/webhook`;
    await inter.registerWebhook(url);
    res.status(200).json({ ok: true, webhookUrl: url });
  } catch (e) {
    console.error("registerWebhook:", e.message);
    res.status(502).json({ error: "O Inter recusou o registro: " + e.message });
  }
};
