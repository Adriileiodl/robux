// Integracao com a API Pix do Banco Inter (conta PJ) usando mTLS (certificado)
const https = require("https");
const crypto = require("crypto");

const HOST = "cdpj.partners.bancointer.com.br";
const SCOPES = "cob.write cob.read pix.read webhook.write webhook.read";

function pem(name) {
  const b64 = process.env[name + "_B64"];
  if (b64) return Buffer.from(b64, "base64").toString("utf8");
  return (process.env[name] || "").replace(/\\n/g, "\n");
}

function request(method, path, headers, body) {
  const cert = pem("INTER_CERT");
  const key = pem("INTER_KEY");
  if (!cert || !key) throw new Error("Certificado do Inter nao configurado (INTER_CERT_B64 / INTER_KEY_B64).");
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: HOST, path, method, headers, cert, key, timeout: 15000 },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let data = {};
          try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
          if (res.statusCode >= 200 && res.statusCode < 300) resolve({ status: res.statusCode, data });
          else reject(Object.assign(new Error(`Inter ${res.statusCode}: ${text.slice(0, 300)}`), { status: res.statusCode, data }));
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Inter: tempo esgotado")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

let tokenCache = { value: null, exp: 0 };
async function getToken() {
  if (tokenCache.value && Date.now() < tokenCache.exp) return tokenCache.value;
  const id = process.env.INTER_CLIENT_ID;
  const secret = process.env.INTER_CLIENT_SECRET;
  if (!id || !secret) throw new Error("INTER_CLIENT_ID / INTER_CLIENT_SECRET nao configurados.");
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    scope: SCOPES,
    grant_type: "client_credentials",
  }).toString();
  const { data } = await request(
    "POST",
    "/oauth/v2/token",
    { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) },
    body
  );
  tokenCache = { value: data.access_token, exp: Date.now() + Math.max((data.expires_in || 3600) - 60, 30) * 1000 };
  return tokenCache.value;
}

async function api(method, path, json) {
  const token = await getToken();
  const body = json ? JSON.stringify(json) : null;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (body) headers["Content-Length"] = Buffer.byteLength(body);
  if (process.env.INTER_CONTA_CORRENTE) headers["x-conta-corrente"] = process.env.INTER_CONTA_CORRENTE;
  try {
    return (await request(method, path, headers, body)).data;
  } catch (e) {
    if (e.status === 401) tokenCache = { value: null, exp: 0 }; // token vencido: renova na proxima
    throw e;
  }
}

// txid: 26 a 35 caracteres alfanumericos
function newTxid() {
  return crypto.randomUUID().replace(/-/g, "");
}

// Cria cobranca Pix imediata. valor em string "2.50"
async function createCob({ txid, valor, expiracao, descricao }) {
  const key = process.env.INTER_PIX_KEY;
  if (!key) throw new Error("INTER_PIX_KEY nao configurada.");
  const data = await api("PUT", `/pix/v2/cob/${txid}`, {
    calendario: { expiracao },
    valor: { original: valor },
    chave: key,
    solicitacaoPagador: String(descricao || "Pedido").slice(0, 140),
  });
  if (!data.pixCopiaECola) throw new Error("Inter nao retornou o codigo Pix copia e cola.");
  return data;
}

async function getCob(txid) {
  return api("GET", `/pix/v2/cob/${txid}`);
}

async function registerWebhook(url) {
  const key = process.env.INTER_PIX_KEY;
  if (!key) throw new Error("INTER_PIX_KEY nao configurada.");
  return api("PUT", `/pix/v2/webhook/${encodeURIComponent(key)}`, { webhookUrl: url });
}

async function getWebhook() {
  const key = process.env.INTER_PIX_KEY;
  return api("GET", `/pix/v2/webhook/${encodeURIComponent(key)}`);
}

module.exports = { newTxid, createCob, getCob, registerWebhook, getWebhook };
