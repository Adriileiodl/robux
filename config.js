// Dados publicos da loja (preco, minimo, estoque, tawk.to)
const cfg = require("../lib/config");
const { getStock, sweepExpired } = require("../lib/orders");

module.exports = async (req, res) => {
  try {
    try { await sweepExpired(); } catch (e) { console.error("sweep:", e.message); }
    const stock = await getStock();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      storeName: cfg.STORE_NAME,
      priceCents: cfg.PRICE_CENTS_PER_ROBUX,
      minQty: cfg.MIN_QTY,
      stock,
      tawk: {
        propertyId: process.env.TAWK_PROPERTY_ID || "",
        widgetId: process.env.TAWK_WIDGET_ID || "default",
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao carregar a loja." });
  }
};
