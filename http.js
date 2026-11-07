const crypto = require("crypto");
const { cmd } = require("./redis");

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "desconhecido";
}

function sha(s) {
  return crypto.createHash("sha256").update(String(s)).digest();
}

// Protege rotas do painel do dono
function adminOnly(req, res) {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) {
    res.status(500).json({ error: "ADMIN_PASSWORD nao configurada no servidor." });
    return false;
  }
  const given = req.headers["x-admin-password"] || "";
  if (!crypto.timingSafeEqual(sha(given), sha(expected))) {
    res.status(401).json({ error: "Senha incorreta." });
    return false;
  }
  return true;
}

// Limita quantidade de chamadas por IP numa janela de tempo
async function rateLimit(req, name, max, windowSec) {
  const key = `rl:${name}:${clientIp(req)}`;
  const n = await cmd("INCR", key);
  if (n === 1) await cmd("EXPIRE", key, windowSec);
  return n <= max;
}

module.exports = { clientIp, adminOnly, rateLimit };
