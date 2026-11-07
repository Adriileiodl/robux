// ============================================================
//  SITE DA LOJA (cliente)
// ============================================================
(() => {
  const $ = (id) => document.getElementById(id);
  const brl = (c) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const LS_IDS = "robux_pedidos_v1";
  const LS_AVISADOS = "robux_avisados_v1";
  const TERMINAIS = ["entregue", "expirado", "cancelado"];

  let cfg = null;
  let cupom = null; // { code, pct }
  let atual = null; // id do pedido aberto no modal
  const pedidos = {}; // id -> pedido

  const ler = (k) => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  async function api(path, opts = {}) {
    const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
    let j = {};
    try { j = await r.json(); } catch {}
    if (!r.ok) throw Object.assign(new Error(j.error || "Erro de conexão. Tente novamente."), { status: r.status });
    return j;
  }

  /* ---------- tawk.to ---------- */
  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();
  let tawkPronto = false;
  const fila = [];
  window.Tawk_API.onLoad = function () { tawkPronto = true; fila.splice(0).forEach((f) => f()); };
  const noChat = (f) => (tawkPronto ? f() : fila.push(f));

  function carregarTawk() {
    if (!cfg.tawk.propertyId) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://embed.tawk.to/${cfg.tawk.propertyId}/${cfg.tawk.widgetId}`;
    s.charset = "UTF-8";
    s.setAttribute("crossorigin", "*");
    document.head.appendChild(s);
  }
  function abrirChat() {
    try { window.Tawk_API.maximize(); } catch { alert("O chat ainda está carregando. Tente novamente em instantes."); }
  }
  function resumoPedido(o) {
    return (
      `Olá! Meu pagamento Pix foi confirmado.\n` +
      `Pedido: ${o.id.slice(0, 8).toUpperCase()}\n` +
      `Nick Roblox: ${o.nick}\n` +
      `Quantidade: ${o.qty} ROBUX\n` +
      `Cupom: ${o.coupon || "nenhum"}\n` +
      `Total pago: ${brl(o.totalCents)}`
    );
  }
  function avisarChat(o) {
    noChat(() => {
      try {
        window.Tawk_API.setAttributes({ name: o.nick }, function () {});
        window.Tawk_API.addEvent(
          "pedido-pago",
          { pedido: o.id.slice(0, 8).toUpperCase(), nick: o.nick, robux: String(o.qty), total: brl(o.totalCents), status: "aguardando aprovacao" },
          function () {}
        );
      } catch {}
    });
  }

  /* ---------- Visual ---------- */
  (function particulas() {
    const box = $("particles");
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("span");
      p.className = "particle";
      p.style.left = Math.random() * 100 + "%";
      p.style.width = p.style.height = 2 + Math.random() * 5 + "px";
      p.style.animationDuration = 9 + Math.random() * 14 + "s";
      p.style.animationDelay = -Math.random() * 20 + "s";
      box.appendChild(p);
    }
  })();
  $("ano").textContent = new Date().getFullYear();

  /* ---------- Config / estoque ---------- */
  async function carregarConfig(primeira) {
    cfg = await api("/api/config");
    $("lojaNome").textContent = cfg.storeName;
    $("lojaNome2").textContent = cfg.storeName;
    document.title = `${cfg.storeName} - Compre ROBUX com Pix`;
    $("statEstoque").textContent = cfg.stock.toLocaleString("pt-BR");
    $("statPreco").textContent = brl(cfg.priceCents);
    $("statMin").textContent = cfg.minQty;
    $("qtd").min = cfg.minQty;
    $("qtd").placeholder = `Mínimo ${cfg.minQty}`;
    $("qtdInfo").textContent = cfg.stock > 0
      ? `Mínimo ${cfg.minQty} • Disponível: ${cfg.stock.toLocaleString("pt-BR")} ROBUX`
      : "Sem estoque no momento. Volte em breve!";
    if (primeira) carregarTawk();
    calcular();
  }

  /* ---------- Cálculo ---------- */
  function calcular() {
    const qtd = parseInt($("qtd").value, 10) || 0;
    const sub = qtd * (cfg ? cfg.priceCents : 0);
    const desc = cupom ? Math.round((sub * cupom.pct) / 100) : 0;
    const total = qtd ? Math.max(sub - desc, 1) : 0;
    $("rQtd").textContent = qtd.toLocaleString("pt-BR");
    $("rSub").textContent = brl(sub);
    $("rDesc").textContent = "- " + brl(desc);
    $("rTotal").textContent = brl(total);
  }
  $("qtd").addEventListener("input", calcular);

  /* ---------- Cupom ---------- */
  $("aplicarCupom").addEventListener("click", async () => {
    const cod = $("cupom").value.trim();
    const info = $("cupomInfo");
    info.classList.remove("ok");
    if (!cod) { cupom = null; info.textContent = ""; return calcular(); }
    try {
      const r = await api("/api/coupon?code=" + encodeURIComponent(cod));
      if (r.valid) {
        cupom = { code: r.code, pct: r.pct };
        info.textContent = `Cupom ${r.code} aplicado: ${r.pct}% de desconto!`;
        info.classList.add("ok");
      } else {
        cupom = null;
        info.textContent = "Cupom inválido.";
      }
    } catch (e) {
      cupom = null;
      info.textContent = e.message;
    }
    calcular();
  });
  $("cupom").addEventListener("input", () => {
    // mudou o texto: o cupom precisa ser aplicado de novo
    if (cupom && $("cupom").value.trim().toUpperCase() !== cupom.code) {
      cupom = null; $("cupomInfo").textContent = ""; calcular();
    }
  });

  /* ---------- Checkout ---------- */
  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const erro = $("erro");
    erro.textContent = "";
    const qtd = parseInt($("qtd").value, 10);
    const nick = $("nick").value.trim();
    if (!Number.isInteger(qtd) || qtd < cfg.minQty) return (erro.textContent = `A quantidade mínima é ${cfg.minQty} ROBUX.`);
    if (qtd > cfg.stock) return (erro.textContent = `Estoque insuficiente. Disponível: ${cfg.stock.toLocaleString("pt-BR")} ROBUX.`);
    if (!/^[A-Za-z0-9_]{3,20}$/.test(nick)) return (erro.textContent = "Nick inválido (3 a 20 caracteres: letras, números e _).");

    const btn = $("btnGerar");
    btn.disabled = true; btn.textContent = "Gerando Pix...";
    try {
      // se o texto do cupom foi digitado mas nao aplicado, o servidor valida mesmo assim
      const body = { qty: qtd, nick, coupon: $("cupom").value.trim() };
      const { order } = await api("/api/checkout", { method: "POST", body: JSON.stringify(body) });
      const ids = ler(LS_IDS).filter((x) => x !== order.id);
      ids.unshift(order.id);
      gravar(LS_IDS, ids.slice(0, 30));
      pedidos[order.id] = order;
      atual = order.id;
      renderPedidos();
      abrirModal(order, true);
      carregarConfig(false).catch(() => {});
    } catch (err) {
      erro.textContent = err.message;
      carregarConfig(false).catch(() => {});
    } finally {
      btn.disabled = false; btn.textContent = "Gerar Pix";
    }
  });

  /* ---------- Modal ---------- */
  function stage(nome) {
    ["stagePagar", "stagePago", "stageFim"].forEach((s) => $(s).classList.toggle("hidden", s !== nome));
  }
  function abrirModal(o, novo) {
    atual = o.id;
    $("modal").classList.remove("hidden");
    if (o.status === "aguardando_pagamento") {
      stage("stagePagar");
      $("pedidoTxt").textContent = `${o.qty.toLocaleString("pt-BR")} ROBUX para ${o.nick}` + (o.coupon ? ` • cupom ${o.coupon}` : "");
      $("pixValor").textContent = brl(o.totalCents);
      $("pixCodigo").value = o.pix || "";
      $("qrcode").innerHTML = "";
      if (o.pix) new QRCode($("qrcode"), { text: o.pix, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
      tick();
    } else {
      renderModal(o);
    }
  }
  function renderModal(o) {
    if (o.status === "aguardando_pagamento") { stage("stagePagar"); return; }
    if (o.status === "pago_aguardando_aprovacao" || o.status === "pago_sem_estoque") {
      stage("stagePago");
      $("pagoTxt").textContent = `${o.qty.toLocaleString("pt-BR")} ROBUX para ${o.nick} • ${brl(o.totalCents)}`;
    } else if (o.status === "entregue") {
      stage("stageFim");
      $("fimTitulo").textContent = "Pedido entregue! 🎉";
      $("fimTxt").textContent = "Seus ROBUX foram enviados. Obrigado pela compra!";
    } else {
      stage("stageFim");
      $("fimTitulo").textContent = o.status === "expirado" ? "Pix expirado" : "Pedido cancelado";
      $("fimTxt").textContent = o.status === "expirado"
        ? "O tempo para pagamento acabou e o estoque foi liberado. Se você já pagou, fale com o suporte no chat."
        : "Esse pedido foi cancelado. Fale com o suporte no chat se tiver dúvidas.";
    }
  }
  function tick() {
    const o = pedidos[atual];
    if (!o || o.status !== "aguardando_pagamento" || $("modal").classList.contains("hidden")) return;
    const s = Math.max(0, Math.floor((o.pixExpiresAt - Date.now()) / 1000));
    $("timer").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    setTimeout(tick, 1000);
  }
  $("fechar").addEventListener("click", () => $("modal").classList.add("hidden"));
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("modal").classList.add("hidden"); });
  $("copiar").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("pixCodigo").value); }
    catch { $("pixCodigo").select(); document.execCommand("copy"); }
    $("copiar").textContent = "Copiado ✓";
    setTimeout(() => ($("copiar").textContent = "Copiar código Pix"), 2000);
  });
  $("abrirChat").addEventListener("click", (e) => { e.preventDefault(); abrirChat(); });
  $("abrirChat2").addEventListener("click", () => { $("modal").classList.add("hidden"); abrirChat(); });
  $("copiarResumo").addEventListener("click", async () => {
    const o = pedidos[atual];
    if (!o) return;
    try { await navigator.clipboard.writeText(resumoPedido(o)); } catch {}
    $("copiarResumo").textContent = "Resumo copiado ✓";
    setTimeout(() => ($("copiarResumo").textContent = "Copiar resumo do pedido"), 2000);
  });

  /* ---------- Meus pedidos (carrinho) ---------- */
  const STATUS = {
    aguardando_pagamento: ["Aguardando pagamento", "warn"],
    pago_aguardando_aprovacao: ["Pago • aguardando aprovação", "info"],
    pago_sem_estoque: ["Pago • em análise", "info"],
    entregue: ["Entregue", "ok"],
    expirado: ["Expirado", "bad"],
    cancelado: ["Cancelado", "bad"],
  };
  function renderPedidos() {
    const ids = ler(LS_IDS).filter((id) => pedidos[id]);
    $("pedidos").classList.toggle("hidden", ids.length === 0);
    $("contPedidos").textContent = ids.length;
    const box = $("listaPedidos");
    box.innerHTML = "";
    for (const id of ids) {
      const o = pedidos[id];
      const [txt, cor] = STATUS[o.status] || [o.status, ""];
      const div = document.createElement("div");
      div.className = "pedido";
      const info = document.createElement("div");
      const b = document.createElement("b");
      b.textContent = `${o.qty.toLocaleString("pt-BR")} ROBUX • ${brl(o.totalCents)}`;
      const sm = document.createElement("small");
      sm.textContent = `Nick: ${o.nick} • Pedido ${o.id.slice(0, 8).toUpperCase()}`;
      info.append(b, sm);
      const dir = document.createElement("div");
      dir.className = "acoes";
      const tag = document.createElement("span");
      tag.className = "tag " + cor;
      tag.textContent = txt;
      dir.appendChild(tag);
      const ver = document.createElement("button");
      ver.className = "btn ghost sm";
      ver.textContent = o.status === "aguardando_pagamento" ? "Ver Pix" : "Detalhes";
      ver.addEventListener("click", () => abrirModal(o, false));
      dir.appendChild(ver);
      div.append(info, dir);
      box.appendChild(div);
    }
  }

  function aplicar(o) {
    const antes = pedidos[o.id] && pedidos[o.id].status;
    pedidos[o.id] = o;
    renderPedidos();
    if (atual === o.id && !$("modal").classList.contains("hidden")) renderModal(o);
    if (antes === "aguardando_pagamento" && o.status === "pago_aguardando_aprovacao") {
      const av = ler(LS_AVISADOS);
      if (!av.includes(o.id)) { av.push(o.id); gravar(LS_AVISADOS, av.slice(-50)); }
      avisarChat(o);
      if (atual === o.id && !$("modal").classList.contains("hidden")) {
        try { navigator.clipboard.writeText(resumoPedido(o)); } catch {}
        abrirChat();
      }
      carregarConfig(false).catch(() => {});
    }
  }

  async function atualizarPedidos() {
    const ids = Object.keys(pedidos).filter((id) => !TERMINAIS.includes(pedidos[id].status));
    await Promise.all(ids.map(async (id) => {
      try { aplicar((await api("/api/order?id=" + id)).order); } catch {}
    }));
  }

  async function carregarPedidosSalvos() {
    const ids = ler(LS_IDS);
    const ok = [];
    await Promise.all(ids.map(async (id) => {
      try { pedidos[id] = (await api("/api/order?id=" + id)).order; ok.push(id); }
      catch (e) { if (e.status !== 404) ok.push(id); }
    }));
    gravar(LS_IDS, ids.filter((id) => ok.includes(id) || pedidos[id]));
    renderPedidos();
  }

  /* ---------- Início ---------- */
  carregarConfig(true).catch((e) => { $("qtdInfo").textContent = e.message; });
  carregarPedidosSalvos();
  setInterval(atualizarPedidos, 4000);
  setInterval(() => carregarConfig(false).catch(() => {}), 60000);
})();
