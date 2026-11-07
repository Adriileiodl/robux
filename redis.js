// Cliente minimo do Upstash Redis via REST (sem dependencias)
function conf() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Banco de dados nao configurado (KV_REST_API_URL / KV_REST_API_TOKEN).");
  return { url: url.replace(/\/$/, ""), token };
}

async function post(path, body) {
  const { url, token } = conf();
  const r = await fetch(url + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Redis: " + (j.error || r.status));
  return j;
}

// Executa um comando. Ex.: cmd("GET", "chave")
async function cmd(...args) {
  const j = await post("", args.map((a) => (typeof a === "number" ? String(a) : a)));
  if (j.error) throw new Error("Redis: " + j.error);
  return j.result;
}

// Executa varios comandos de uma vez. Retorna array de resultados.
async function pipeline(cmds) {
  if (!cmds.length) return [];
  const j = await post("/pipeline", cmds.map((c) => c.map((a) => (typeof a === "number" ? String(a) : a))));
  return j.map((x) => {
    if (x.error) throw new Error("Redis: " + x.error);
    return x.result;
  });
}

module.exports = { cmd, pipeline };
