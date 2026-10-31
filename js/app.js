// Interface do Invest Simulador. Usa Dados (data.js), Calc (calc.js), Charts (charts.js) e Live (live.js).

// ============ Utilitários ============
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (id) => Math.max(0, parseFloat($(id).value) || 0);
const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtBRL0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtCompacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const brl = (v) => fmtBRL.format(v);
const brl0 = (v) => fmtBRL0.format(v);
const brlC = (v) => "R$ " + fmtCompacto.format(v);
const pct = (v, casas = 1, sinal = false) =>
  (sinal && v > 0 ? "+" : "") + v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) + "%";
const classeVar = (v) => (v > 0 ? "sobe" : v < 0 ? "desce" : "");
const css = (v) => Charts.css(v);

const CLASSES = Dados.CLASSES;
const IDS = CLASSES.map((c) => c.id);
const classe = (id) => CLASSES.find((c) => c.id === id);
const corClasse = (id) => {
  const i = IDS.indexOf(id);
  return css(i >= 0 ? `--s${i + 1}` : "--s0");
};
const nomeClasse = (id) => (id === "outros" ? "Outros" : classe(id)?.nome ?? id);
const curtoClasse = (id) => (id === "outros" ? "Outros" : classe(id)?.curto ?? id);
const NOMES_RISCO = ["", "Muito baixo", "Baixo", "Médio", "Alto", "Muito alto"];
const medidorRisco = (n, compacto) =>
  `<span class="risco" data-n="${n}" title="Risco ${n} de 5: ${NOMES_RISCO[n]}"><span class="risco-barras">${"<i></i>".repeat(5)}</span>${compacto ? "" : NOMES_RISCO[n]}</span>`;

function textoPrazo(meses) {
  const a = Math.floor(meses / 12), m = meses % 12, p = [];
  if (a) p.push(a + (a === 1 ? " ano" : " anos"));
  if (m) p.push(m + (m === 1 ? " mês" : " meses"));
  return p.join(" e ") || "0 meses";
}

// ============ Estado salvo no navegador ============
const CHAVE = "invest-simulador:v2";
function ler(chave) {
  try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; }
}
function gravar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({
      perfil: estado.perfil, carteira: estado.carteira, premissas: estado.premissas, mercado: estado.mercadoManual,
    }));
  } catch { /* sem armazenamento: segue em memória */ }
}

const EXEMPLO = [
  { nome: "Tesouro Selic 2029", classe: "cdi", valor: 12000 },
  { nome: "Tesouro IPCA+ 2045", classe: "ipca", valor: 6000 },
  { nome: "BOVA11", classe: "ibov", valor: 5000 },
  { nome: "Fundos imobiliários", classe: "ifix", valor: 3000 },
  { nome: "IVVB11", classe: "sp500", valor: 4000 },
  { nome: "Bitcoin", classe: "btc", valor: 1500 },
];

function carregarEstado() {
  const salvo = ler(CHAVE) || {};
  let carteira = salvo.carteira;
  if (!carteira) {
    // Migra a carteira da primeira versão do app, se existir.
    const antiga = ler("invest-simulador:carteira");
    const mapa = { "Renda fixa": "cdi", "Ações": "ibov", "FIIs": "ifix", "ETFs": "ibov", "Exterior": "sp500", "Cripto": "btc", "Outros": "outros" };
    carteira = Array.isArray(antiga) && antiga.length
      ? { itens: antiga.map((a) => ({ nome: a.nome, classe: mapa[a.cat] || "outros", valor: a.valor })), exemplo: false }
      : { itens: EXEMPLO.map((x) => ({ ...x })), exemplo: true };
  }
  return {
    perfil: salvo.perfil || { respostas: Array(Dados.QUESTOES.length).fill(null), id: null },
    carteira,
    premissas: salvo.premissas || {},
    mercadoManual: salvo.mercado || null,
    bcb: null, // resposta do Banco Central
    cripto: null, // cotações da CoinGecko
    criptoErro: false,
  };
}
const estado = carregarEstado();

// Taxas atuais: vêm dos campos da aba Renda fixa (preenchidos pelo BCB quando disponível).
function mercado() {
  return { selic: num("selic"), cdi: num("cdi"), ipca: num("ipca") };
}
function premissas() {
  const p = {};
  IDS.forEach((id) => (p[id] = { ...Dados.PREMISSAS[id], ...(estado.premissas[id] || {}) }));
  p.cdi = { ...p.cdi, ret: mercado().cdi };
  return p;
}
function perfilAtual() {
  return estado.perfil.id || "moderado";
}

// ============ Navegação ============
const ROTAS = ["visao", "perfil", "projecao", "historico", "cripto", "renda-fixa", "onde-investir", "carteira"];
const RENDER = {};
let rotaAtual = null;
function irPara(rota, rolar) {
  if (!ROTAS.includes(rota)) rota = "visao";
  rotaAtual = rota;
  ROTAS.forEach((r) => ($("v-" + r).hidden = r !== rota));
  document.querySelectorAll(".menu a").forEach((a) => {
    if (a.dataset.rota === rota) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.querySelector(`.menu a[data-rota="${rota}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  RENDER[rota]?.();
  if (rolar) window.scrollTo({ top: 0 });
}
window.addEventListener("hashchange", () => irPara(location.hash.slice(1), true));

// ============ Fita de indicadores ============
function renderFita() {
  const m = mercado();
  const real = Calc.juroReal(m.selic / 100, m.ipca / 100) * 100;
  const itens = [
    ["Selic", pct(m.selic, 2)],
    ["CDI", pct(m.cdi, 2)],
    ["IPCA 12m", pct(m.ipca, 2)],
    ["Juro real", pct(real, 2)],
  ];
  if (estado.bcb?.dolar) itens.push(["Dólar", "R$ " + estado.bcb.dolar.valor.toLocaleString("pt-BR", { minimumFractionDigits: 4 })]);
  const extra = (estado.cripto || []).filter((c) => ["bitcoin", "ethereum"].includes(c.id)).map((c) => [
    c.simbolo, brl0(c.preco), c.var24h,
  ]);
  $("fita").innerHTML =
    itens.map(([r, v]) => `<div class="fita-item"><span class="fita-rotulo">${r}</span><span class="fita-valor">${v}</span></div>`).join("") +
    extra.map(([r, v, d]) => `<div class="fita-item"><span class="fita-rotulo">${r}</span><span class="fita-valor">${v}</span>${d != null ? `<span class="fita-var ${classeVar(d)}">${pct(d, 1, true)}</span>` : ""}</div>`).join("");
}

function renderFonte() {
  const vivo = estado.bcb && Object.keys(estado.bcb).length > 0;
  const btn = $("fonte-dados");
  btn.classList.toggle("ao-vivo", !!vivo);
  btn.classList.toggle("manual", !vivo);
  const data = vivo ? (estado.bcb.selic || estado.bcb.cdi || Object.values(estado.bcb)[0]).data : null;
  $("fonte-txt").textContent = vivo ? `Ao vivo · BCB ${data}` : "Taxas manuais";
}

// ============ VISÃO GERAL ============
function alocacaoCarteira() {
  const total = estado.carteira.itens.reduce((s, a) => s + a.valor, 0);
  const porClasse = {};
  estado.carteira.itens.forEach((a) => (porClasse[a.classe] = (porClasse[a.classe] || 0) + a.valor));
  return { total, porClasse };
}

function listaAlocacao(aloc, max = 8) {
  return `<ul class="resumo-lista">${Object.entries(aloc).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, max)
    .map(([id, v]) => `<li><span class="ponto" style="background:${corClasse(id)}"></span><span>${esc(curtoClasse(id))}</span><b>${pct(v, 0)}</b></li>`).join("")}</ul>`;
}

function estatisticaModelo(aloc) {
  const p = premissas();
  const w = IDS.map((id) => (aloc[id] || 0) / 100);
  const ret = IDS.reduce((s, id, i) => s + w[i] * p[id].ret, 0);
  let varc = 0;
  for (let i = 0; i < IDS.length; i++)
    for (let j = 0; j < IDS.length; j++)
      varc += w[i] * w[j] * (p[IDS[i]].vol / 100) * (p[IDS[j]].vol / 100) * Dados.CORRELACAO[i][j];
  return { ret, vol: Math.sqrt(varc) * 100 };
}

function renderCartaoPerfil() {
  const respondido = !!estado.perfil.id;
  const id = perfilAtual();
  const perfil = Dados.PERFIS[id];
  const est = estatisticaModelo(perfil.alocacao);
  $("cartao-perfil").innerHTML = `
    <div class="painel-cabeca"><div>
      <p class="sobre">${respondido ? "Seu perfil" : "Exemplo: perfil moderado"}</p>
      <h2>${respondido ? esc(perfil.nome) : "Descubra seu perfil em 1 minuto"}</h2>
      <p class="nota">${respondido ? esc(perfil.resumo) : "Enquanto isso, veja a carteira modelo moderada."}</p>
    </div></div>
    <div class="resumo">
      <div class="grafico rosca" id="g-perfil-mini"></div>
      <div>${listaAlocacao(perfil.alocacao, 6)}
        <p class="nota" style="margin-top:10px">Retorno esperado ${pct(est.ret)} a.a. · volatilidade ${pct(est.vol)}</p>
      </div>
    </div>
    <div class="acoes">
      <a class="botao" href="#${respondido ? "projecao" : "perfil"}">${respondido ? "Projetar meu patrimônio" : "Responder o questionário"}</a>
      ${respondido ? `<a class="botao fantasma" href="#perfil">Refazer</a>` : ""}
    </div>`;
  Charts.rosca($("g-perfil-mini"), IDS.map((c) => ({ nome: curtoClasse(c), valor: perfil.alocacao[c], cor: corClasse(c) })),
    { valor: perfil.nome, rotulo: "carteira modelo" });
}

function renderCartaoCarteira() {
  const { total, porClasse } = alocacaoCarteira();
  const aloc = {};
  Object.entries(porClasse).forEach(([k, v]) => (aloc[k] = total ? (v / total) * 100 : 0));
  $("cartao-carteira").innerHTML = `
    <div class="painel-cabeca"><div>
      <p class="sobre">${estado.carteira.exemplo ? "Carteira de exemplo" : "Minha carteira"}</p>
      <h2>${brl0(total)}</h2>
      <p class="nota">${estado.carteira.itens.length} investimentos em ${Object.keys(porClasse).length} classes</p>
    </div></div>
    <div class="resumo">
      <div class="grafico rosca" id="g-cart-mini"></div>
      <div>${total ? listaAlocacao(aloc, 6) : '<p class="nota">Nenhum investimento cadastrado.</p>'}</div>
    </div>
    <div class="acoes"><a class="botao fantasma" href="#carteira">${estado.carteira.exemplo ? "Cadastrar meus investimentos" : "Ver rebalanceamento"}</a></div>`;
  Charts.rosca($("g-cart-mini"), Object.entries(porClasse).map(([c, v]) => ({ nome: curtoClasse(c), valor: v, cor: corClasse(c) })),
    { valor: brlC(total), rotulo: "total" });
}

function renderMapa() {
  const p = premissas();
  const pontos = CLASSES.map((c) => ({ x: p[c.id].vol, y: p[c.id].ret, rotulo: c.curto, cor: corClasse(c.id) }));
  Object.entries(Dados.PERFIS).forEach(([id, pf]) => {
    const e = estatisticaModelo(pf.alocacao);
    const atual = id === perfilAtual();
    pontos.push({
      x: e.vol, y: e.ret, grupo: "perfis", cor: css("--tinta"), destaque: atual,
      rotulo: atual ? (estado.perfil.id ? "Você: " : "") + pf.nome : pf.nome, nomeTooltip: "Carteira " + pf.nome.toLowerCase(),
    });
  });
  Charts.dispersao($("g-mapa"), pontos, {
    altura: 340, raizX: true, ligar: "perfis", xFmt: (v) => v + "%", yFmt: (v) => v + "%",
    xRotulo: "Volatilidade anual (risco)", yRotulo: "Retorno esperado ao ano", rotulo: "Mapa de risco e retorno",
  });
}

function renderTabelaClasses() {
  const linhas = CLASSES.map((c) => {
    const e = Calc.estatisticas(c.hist);
    let idx = 1;
    const traj = [1, ...c.hist.map((r) => (idx *= 1 + r / 100))];
    return `<tr>
      <td><span class="nome-classe"><span class="ponto" style="background:${corClasse(c.id)}"></span><span>${esc(c.nome)}<span class="sub">${esc(c.desc)}</span></span></span></td>
      <td>${medidorRisco(c.risco, true)}</td>
      <td><span class="mini" title="Trajetória de R$ 1 de 2016 a 2024">${Charts.mini(traj.map(Math.log), corClasse(c.id))}</span></td>
      <td class="${classeVar(e.acumulado)}">${pct(e.acumulado * 100, 0, true)}</td>
      <td>${pct(e.cagr * 100, 1)}</td>
      <td class="${classeVar(e.pior)}">${pct(e.pior * 100, 1, true)}</td>
      <td>${e.anosNegativos} de ${c.hist.length}</td>
    </tr>`;
  }).join("");
  const ipca = Calc.estatisticas(Dados.IPCA);
  $("tab-classes").innerHTML = `<thead><tr><th>Classe</th><th>Risco</th><th>2016–2024</th><th>Acumulado</th><th>Ao ano</th><th>Pior ano</th><th>Anos negativos</th></tr></thead>
    <tbody>${linhas}<tr><td><span class="nome-classe"><span class="ponto" style="background:${css("--tinta-3")}"></span><span>Inflação (IPCA)<span class="sub">Quanto os preços subiram no período</span></span></span></td><td></td><td></td><td>${pct(ipca.acumulado * 100, 0, true)}</td><td>${pct(ipca.cagr * 100, 1)}</td><td></td><td></td></tr></tbody>`;
}

RENDER.visao = () => { renderCartaoPerfil(); renderCartaoCarteira(); renderMapa(); renderTabelaClasses(); };

// ============ PERFIL ============
function montarQuestionario() {
  $("form-perfil").innerHTML = Dados.QUESTOES.map((q, qi) => `
    <fieldset class="questao">
      <legend><span class="n">${qi + 1}/${Dados.QUESTOES.length}</span><span>${esc(q.texto)}</span></legend>
      <div class="opcoes">${q.opcoes.map((o, oi) => `
        <label><input type="radio" name="q-${q.id}" value="${oi}" ${estado.perfil.respostas[qi] === oi ? "checked" : ""} /><span>${esc(o)}</span></label>`).join("")}
      </div>
    </fieldset>`).join("");
  $("form-perfil").addEventListener("change", (e) => {
    const qi = Dados.QUESTOES.findIndex((q) => "q-" + q.id === e.target.name);
    if (qi < 0) return;
    estado.perfil.respostas[qi] = +e.target.value;
    const completo = estado.perfil.respostas.every((r) => r !== null);
    estado.perfil.id = completo ? Calc.perfilPorRespostas(estado.perfil.respostas).id : estado.perfil.id;
    gravar();
    renderResultadoPerfil();
    if (completo) $("pj-carteira").value = estado.perfil.id;
  });
}

function renderResultadoPerfil() {
  const resp = estado.perfil.respostas;
  const feitas = resp.filter((r) => r !== null).length;
  const el = $("res-perfil");
  if (feitas < resp.length) {
    el.innerHTML = `<p class="sobre">Resultado</p><h2>Responda todas as perguntas</h2>
      <p class="nota">${feitas} de ${resp.length} respondidas.</p>
      <div class="medidor">${[0, 1, 2, 3].map(() => "<div></div>").join("")}</div>
      <div class="medidor-rotulos"><span>Conservador</span><span>Moderado</span><span>Arrojado</span><span>Agressivo</span></div>`;
    return;
  }
  const r = Calc.perfilPorRespostas(resp);
  const pf = Dados.PERFIS[r.id];
  const est = estatisticaModelo(pf.alocacao);
  const ordem = ["conservador", "moderado", "arrojado", "agressivo"];
  el.innerHTML = `
    <p class="sobre">Seu perfil</p>
    <p class="perfil-nome">${esc(pf.nome)}</p>
    <p class="nota">${esc(pf.resumo)}</p>
    <div class="medidor">${ordem.map((o, i) => `<div class="${i <= ordem.indexOf(r.id) ? "ativo" : ""}"></div>`).join("")}</div>
    <div class="medidor-rotulos"><span>Conservador</span><span>Moderado</span><span>Arrojado</span><span>Agressivo</span></div>
    ${r.alerta ? `<p class="aviso" style="margin-top:14px">${esc(r.alerta)}</p>` : ""}
    <h3 style="margin-top:18px">Carteira modelo</h3>
    <div class="resumo" style="margin-top:10px">
      <div class="grafico rosca" id="g-perfil"></div>
      <div>${listaAlocacao(pf.alocacao)}</div>
    </div>
    <div class="kpis" style="margin-top:14px">
      <div class="kpi"><span class="kpi-rotulo">Retorno esperado</span><span class="kpi-valor">${pct(est.ret)}</span><span class="kpi-sub">ao ano, premissa</span></div>
      <div class="kpi"><span class="kpi-rotulo">Volatilidade</span><span class="kpi-valor">${pct(est.vol)}</span><span class="kpi-sub">oscilação típica em 1 ano</span></div>
    </div>
    <p class="nota" style="margin-top:12px">Carteira educativa, não é recomendação. Ajuste à sua realidade.</p>
    <div class="acoes"><a class="botao" href="#projecao">Projetar esta carteira</a><a class="botao fantasma" href="#onde-investir">Onde investir</a></div>`;
  Charts.rosca($("g-perfil"), IDS.map((c) => ({ nome: curtoClasse(c), valor: pf.alocacao[c], cor: corClasse(c) })), { valor: pct(est.ret, 1), rotulo: "ao ano" });
}

RENDER.perfil = renderResultadoPerfil;

// ============ PROJEÇÃO ============
let pesosPersonalizados = { ...Dados.PERFIS.moderado.alocacao };

function alocacaoProjecao() {
  const tipo = $("pj-carteira").value;
  if (Dados.PERFIS[tipo]) return { aloc: Dados.PERFIS[tipo].alocacao, nota: null };
  if (tipo === "personalizada") return { aloc: pesosPersonalizados, nota: null };
  const { total, porClasse } = alocacaoCarteira();
  const soma = IDS.reduce((s, id) => s + (porClasse[id] || 0), 0);
  if (!soma) return { aloc: Dados.PERFIS.moderado.alocacao, nota: "Sua carteira está vazia: usando a carteira moderada." };
  const aloc = {};
  IDS.forEach((id) => (aloc[id] = ((porClasse[id] || 0) / soma) * 100));
  return { aloc, nota: porClasse.outros ? `"Outros" (${brl0(porClasse.outros)} de ${brl0(total)}) ficou fora da projeção.` : null };
}

function renderPesos() {
  const tipo = $("pj-carteira").value;
  const { aloc, nota } = alocacaoProjecao();
  const editavel = tipo === "personalizada";
  const soma = IDS.reduce((s, id) => s + (aloc[id] || 0), 0);
  $("pj-pesos").innerHTML = IDS.map((id) => `
    <div class="peso">
      <span class="ponto" style="background:${corClasse(id)}"></span><label for="pw-${id}" style="margin:0">${esc(curtoClasse(id))}</label><span class="v" id="pwv-${id}">${pct(aloc[id] || 0, 0)}</span>
      ${editavel ? `<input type="range" id="pw-${id}" data-id="${id}" min="0" max="100" step="1" value="${Math.round(aloc[id] || 0)}" />` : ""}
    </div>`).join("") +
    `<div class="peso-total ${editavel && Math.round(soma) !== 100 ? "erro" : ""}" id="pw-total">${editavel ? `Total: ${pct(soma, 0)}${Math.round(soma) !== 100 ? " (a projeção normaliza para 100%)" : ""}` : ""}</div>` +
    (nota ? `<p class="nota">${esc(nota)}</p>` : "");
}

let timerProj = null;
function agendarProjecao() {
  clearTimeout(timerProj);
  $("g-proj").style.opacity = 0.5;
  timerProj = setTimeout(rodarProjecao, 180);
}

function rodarProjecao() {
  const anos = Math.max(1, Math.min(40, Math.round(num("pj-anos")) || 1));
  const { aloc } = alocacaoProjecao();
  const m = mercado();
  const r = Calc.monteCarlo({
    alocacao: aloc, premissas: premissas(), ids: IDS, correlacao: Dados.CORRELACAO,
    inicial: num("pj-inicial"), mensal: num("pj-mensal"), anos, inflacao: m.ipca, sims: anos > 20 ? 1200 : 2000,
  });
  $("g-proj").style.opacity = 1;
  const real = (v) => v / r.deflator;
  $("pj-kpis").innerHTML = `
    <div class="kpi principal"><span class="kpi-rotulo">Cenário mediano</span><span class="kpi-valor">${brl0(r.final.p50)}</span><span class="kpi-sub">${brl0(real(r.final.p50))} em reais de hoje</span></div>
    <div class="kpi"><span class="kpi-rotulo">Cenário ruim (5%)</span><span class="kpi-valor">${brl0(r.final.p5)}</span><span class="kpi-sub">95% dos cenários terminam acima</span></div>
    <div class="kpi"><span class="kpi-rotulo">Cenário bom (95%)</span><span class="kpi-valor">${brl0(r.final.p95)}</span><span class="kpi-sub">só 5% terminam acima</span></div>
    <div class="kpi"><span class="kpi-rotulo">Abaixo do investido</span><span class="kpi-valor ${r.probPerda > 0.05 ? "perda" : ""}">${pct(r.probPerda * 100, 1)}</span><span class="kpi-sub">${pct(r.probPerdaReal * 100, 1)} descontada a inflação</span></div>
    <div class="kpi"><span class="kpi-rotulo">Queda típica no caminho</span><span class="kpi-valor perda">${pct(r.quedaMediana * 100, 0)}</span><span class="kpi-sub">pior 5%: ${pct(r.quedaRuim * 100, 0)}</span></div>`;
  $("pj-legenda-nota").textContent = `Total investido: ${brl0(r.investido)} · retorno esperado da carteira ${pct(r.retornoEsperado)} a.a. · IPCA ${pct(m.ipca)} a.a.`;
  const ac = css("--acento");
  $("pj-legenda").innerHTML = `<span><i class="traco" style="background:${ac}"></i>Mediana</span><span><i class="faixa" style="background:${ac};opacity:.35"></i>50% dos cenários</span><span><i class="faixa" style="background:${ac};opacity:.15"></i>90% dos cenários</span><span><i class="traco" style="background:${css("--tinta-3")}"></i>Investido</span>`;
  const s = r.serie;
  Charts.linhas($("g-proj"), {
    altura: 320, x: s.map((p) => p.mes), xTicks: Math.min(anos + 1, 6),
    xFmt: (mes) => (mes === 0 ? "hoje" : Math.round(mes / 12) + (Math.round(mes / 12) === 1 ? " ano" : " anos")),
    xTooltip: (mes) => mes === 0 ? "Hoje" : `Após ${textoPrazo(mes)}`,
    yFmt: brlC, rotulo: "Projeção do patrimônio",
    faixas: [
      { lo: s.map((p) => p.p5), hi: s.map((p) => p.p95), cor: ac, opacidade: 0.12 },
      { lo: s.map((p) => p.p25), hi: s.map((p) => p.p75), cor: ac, opacidade: 0.22 },
    ],
    series: [
      { nome: "Investido", cor: css("--tinta-3"), valores: s.map((p) => p.investido), tracejado: true, largura: 1.5 },
      { nome: "Mediana", cor: ac, valores: s.map((p) => p.p50), largura: 2.5 },
    ],
    linhasTooltip: (i) => [
      { cor: ac, nome: "Mediana", valor: brl0(s[i].p50) },
      { nome: "50% entre", valor: `${brlC(s[i].p25)} e ${brlC(s[i].p75)}` },
      { nome: "90% entre", valor: `${brlC(s[i].p5)} e ${brlC(s[i].p95)}` },
      { cor: css("--tinta-3"), nome: "Investido", valor: brl0(s[i].investido) },
    ],
  });
}

function renderPremissas() {
  const p = premissas();
  $("tab-premissas").innerHTML = `<thead><tr><th>Classe</th><th>Retorno a.a.</th><th>Volatilidade</th></tr></thead><tbody>` +
    CLASSES.map((c) => `<tr>
      <td><span class="nome-classe"><span class="ponto" style="background:${corClasse(c.id)}"></span>${esc(c.nome)}</span></td>
      <td><input type="number" step="0.5" id="pm-ret-${c.id}" data-id="${c.id}" data-campo="ret" value="${p[c.id].ret}" ${c.id === "cdi" ? "disabled title=\"Vem do CDI da aba Renda fixa\"" : ""} aria-label="Retorno de ${esc(c.nome)}" /></td>
      <td><input type="number" step="0.5" min="0" id="pm-vol-${c.id}" data-id="${c.id}" data-campo="vol" value="${p[c.id].vol}" aria-label="Volatilidade de ${esc(c.nome)}" /></td>
    </tr>`).join("") + "</tbody>";
}

RENDER.projecao = () => { renderPesos(); renderPremissas(); rodarProjecao(); };

// ============ HISTÓRICO ============
const HT_PADRAO = ["cdi", "ibov", "sp500", "btc", "carteira"];
function montarHistorico() {
  $("ht-inicio").innerHTML = Dados.ANOS.map((a) => `<option value="${a}" ${a === 2019 ? "selected" : ""}>${a}</option>`).join("");
  const opcoes = [...CLASSES.map((c) => ({ id: c.id, nome: c.nome, cor: corClasse(c.id) })), { id: "carteira", nome: "Carteira do seu perfil", cor: css("--tinta") }];
  $("ht-classes").innerHTML = opcoes.map((o) => `<label for="ht-${o.id}"><input type="checkbox" id="ht-${o.id}" value="${o.id}" ${HT_PADRAO.includes(o.id) ? "checked" : ""} /><span class="amostra" data-cor="${o.id}" style="background:${o.cor}"></span>${esc(o.nome)}</label>`).join("") +
    `<label class="chave" for="ht-log" style="margin-top:8px"><input type="checkbox" id="ht-log" checked /> Escala logarítmica</label>`;
}

function renderHistorico() {
  const inicio = +$("ht-inicio").value;
  const desde = Dados.ANOS.indexOf(inicio);
  const anos = Dados.ANOS.slice(desde);
  const ipca = Dados.IPCA.slice(desde);
  const real = $("ht-real").checked;
  const log = $("ht-log").checked;
  const inicial = num("ht-inicial"), mensal = num("ht-mensal");
  const marcados = [...$("ht-classes").querySelectorAll("input[type=checkbox]:checked")].map((i) => i.value).filter((v) => v !== "on");
  const historicos = {};
  CLASSES.forEach((c) => (historicos[c.id] = c.hist.slice(desde)));
  const pf = Dados.PERFIS[perfilAtual()];

  const linhas = marcados.map((id) => {
    const rets = id === "carteira" ? Calc.retornosCarteira(pf.alocacao, historicos) : historicos[id];
    const pts = Calc.backtest({ retornosPct: rets, inicial, mensal, inflacaoPct: ipca });
    return {
      id, rets, pts,
      nome: id === "carteira" ? `Carteira ${pf.nome.toLowerCase()}` : classe(id).curto,
      cor: id === "carteira" ? css("--tinta") : corClasse(id),
      valores: pts.map((p) => (real ? p.real : p.saldo)),
    };
  });
  // Mantém as cores das amostras sincronizadas com o tema.
  $("ht-classes").querySelectorAll(".amostra").forEach((a) => (a.style.background = a.dataset.cor === "carteira" ? css("--tinta") : corClasse(a.dataset.cor)));

  const investido = Calc.backtest({ retornosPct: anos.map(() => 0), inicial, mensal });
  const rotulos = ["jan/" + inicio, ...anos.map((a) => "dez/" + a)];
  $("ht-titulo").textContent = real ? "Patrimônio acumulado, em reais de " + inicio : "Patrimônio acumulado";
  $("ht-nota").textContent = `${brl0(inicial)} no início e ${brl0(mensal)} por mês, de janeiro de ${inicio} a dezembro de 2024.` + (log ? " Escala logarítmica: cada linha de grade é um múltiplo do valor." : "");
  $("ht-legenda").innerHTML = linhas.map((l) => `<span><i class="traco" style="background:${l.cor}"></i>${esc(l.nome)}</span>`).join("") +
    `<span><i class="traco" style="background:${css("--tinta-3")};opacity:.6"></i>Investido</span>`;

  if (!linhas.length) {
    $("g-hist").innerHTML = '<div class="vazio-estado">Marque pelo menos uma opção para comparar.</div>';
    $("tab-hist").innerHTML = "";
    return;
  }
  const tr = (v) => (log ? Math.log10(Math.max(1, v)) : v);
  const invVals = investido.map((p) => p.investido);
  Charts.linhas($("g-hist"), {
    altura: 330, x: rotulos, xTicks: Math.min(rotulos.length, 6), rotulo: "Backtest histórico",
    yFmt: log ? (v) => brlC(Math.pow(10, v)) : brlC,
    series: [
      { nome: "Investido", cor: css("--tinta-3"), valores: invVals.map(tr), tracejado: true, largura: 1.5 },
      ...linhas.map((l) => ({ nome: l.nome, cor: l.cor, valores: l.valores.map(tr), largura: l.id === "carteira" ? 3 : 2 })),
    ],
    linhasTooltip: (i) => [
      ...[...linhas].sort((a, b) => b.valores[i] - a.valores[i]).map((l) => ({ cor: l.cor, nome: l.nome, valor: brl0(l.valores[i]) })),
      { cor: css("--tinta-3"), nome: "Investido", valor: brl0(invVals[i]) },
    ],
    yTicks: log ? ticksLog : null,
  });

  const totalInv = invVals[invVals.length - 1];
  const ordenadas = [...linhas].sort((a, b) => b.valores.at(-1) - a.valores.at(-1));
  $("tab-hist").innerHTML = `<thead><tr><th>Opção</th><th>Valor final${real ? " (real)" : ""}</th><th>Lucro nominal</th><th>Ao ano</th><th>Pior ano</th><th>Maior queda</th></tr></thead><tbody>` +
    ordenadas.map((l, i) => {
      const e = Calc.estatisticas(l.rets);
      const fim = l.valores.at(-1);
      const lucro = l.pts.at(-1).saldo - totalInv;
      return `<tr class="${i === 0 ? "melhor" : ""}">
        <td><span class="nome-classe"><span class="ponto" style="background:${l.cor}"></span>${esc(l.nome)}</span></td>
        <td>${brl0(fim)}</td>
        <td class="${classeVar(lucro)}">${brl0(lucro)}</td>
        <td>${pct(e.cagr * 100, 1)}</td>
        <td class="${classeVar(e.pior)}">${pct(e.pior * 100, 1, true)}</td>
        <td class="${e.quedaMax < 0 ? "desce" : ""}">${e.quedaMax < 0 ? pct(e.quedaMax * 100, 0) : "nenhuma"}</td>
      </tr>`;
    }).join("") + `</tbody>`;
}
// Ticks da escala log (valores em log10): 1, 2 e 5 vezes cada potência de 10 dentro da faixa.
function ticksLog(min, max) {
  const out = [];
  for (let k = Math.floor(min); k <= Math.ceil(max); k++)
    [1, 2, 5].forEach((m) => out.push(k + Math.log10(m)));
  let ini = out.filter((v) => v <= min).pop() ?? out[0];
  let fim = out.find((v) => v >= max) ?? out.at(-1);
  let tk = out.filter((v) => v >= ini - 1e-9 && v <= fim + 1e-9);
  if (tk.length > 7) {
    // Faixa muito larga: só potências de 10.
    tk = [];
    for (let k = Math.floor(min); k <= Math.ceil(max); k++) tk.push(k);
  }
  return tk;
}

RENDER.historico = renderHistorico;

// ============ CRIPTO ============
function renderTabelaCripto() {
  const el = $("tab-cripto");
  if (!estado.cripto) {
    $("cr-nota").textContent = estado.criptoErro ? "Cotações ao vivo indisponíveis aqui." : "Buscando cotações…";
    el.innerHTML = estado.criptoErro
      ? `<tbody><tr><td><div class="vazio-estado">Não foi possível falar com a CoinGecko deste endereço. Na versão do app publicada no GitHub Pages as cotações carregam sozinhas; aqui, use o histórico e a calculadora abaixo.</div></td></tr></tbody>`
      : "";
    return;
  }
  $("cr-nota").textContent = "Fonte: CoinGecko, em reais. Atualizado às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + ".";
  const v = (x) => (x == null ? "—" : `<span class="${classeVar(x)}">${pct(x, 1, true)}</span>`);
  el.innerHTML = `<thead><tr><th>Moeda</th><th>Preço</th><th>24h</th><th>7 dias</th><th>1 ano</th><th>Últimos 7 dias</th></tr></thead><tbody>` +
    estado.cripto.map((c) => `<tr>
      <td><span class="nome-classe"><b>${esc(c.simbolo)}</b><span class="sub">${esc(c.nome)}</span></span></td>
      <td>${c.preco < 10 ? brl(c.preco) : brl0(c.preco)}</td><td>${v(c.var24h)}</td><td>${v(c.var7d)}</td><td>${v(c.var1a)}</td>
      <td>${Charts.mini(c.spark, css((c.var7d ?? 0) >= 0 ? "--alta" : "--baixa"))}</td>
    </tr>`).join("") + "</tbody>";
}

function renderCripto() {
  renderTabelaCripto();
  const grupos = [
    { nome: "Bitcoin", curto: "BTC", cor: corClasse("btc"), valores: classe("btc").hist },
    { nome: "Ethereum", curto: "ETH", cor: corClasse("eth"), valores: classe("eth").hist },
    { nome: "Ibovespa", curto: "IBOV", cor: corClasse("ibov"), valores: classe("ibov").hist },
  ];
  $("cr-legenda").innerHTML = grupos.map((g) => `<span><i class="faixa" style="background:${g.cor}"></i>${g.nome}</span>`).join("");
  Charts.barras($("g-cripto-anos"), {
    rotulos: Dados.ANOS.map((a) => (innerWidth < 520 ? "’" + String(a).slice(2) : String(a))), grupos, limite: 300, altura: 290,
    yFmt: (v) => pct(v, 0, true), rotulo: "Retorno anual de Bitcoin, Ethereum e Ibovespa",
  });
  const acima = Dados.ANOS.map((a, i) => {
    const itens = grupos.filter((g) => g.valores[i] > 300).map((g) => `${g.curto} ${pct(g.valores[i], 0, true)}`);
    return itens.length ? `${a}: ${itens.join(", ")}` : null;
  }).filter(Boolean);
  $("cr-cortadas").textContent = "Acima de 300%: " + acima.join(" · ") + ".";
  $("cr-quedas").innerHTML = Dados.QUEDAS_CRIPTO.map((q) => `
    <li><span>${esc(q.ativo)}<small>${esc(q.periodo)}</small></span><b>${pct(q.queda, 0)}</b>
    <span class="barra-queda" aria-hidden="true"><i style="width:${Math.abs(q.queda)}%"></i></span></li>`).join("");
  renderSimCripto();
}

function renderSimCripto() {
  const P = num("cr-patrimonio"), p = +$("cr-pct").value / 100, q = +$("cr-queda").value / 100, a = +$("cr-alta").value / 100;
  $("cr-pct-out").textContent = pct(p * 100, 0);
  $("cr-queda-out").textContent = pct(q * 100, 0);
  $("cr-alta-out").textContent = pct(a * 100, 0, true);
  const emCripto = P * p;
  const totalQueda = P - emCripto + emCripto * (1 + q);
  const totalAlta = P - emCripto + emCripto * (1 + a);
  const recuperar = q > -1 ? (1 / (1 + q) - 1) * 100 : Infinity;
  $("cr-cenarios").innerHTML = `
    <div class="cenario ruim"><span class="kpi-rotulo">Se cair ${pct(-q * 100, 0)}</span><span class="kpi-valor">${brl0(totalQueda)}</span>
      <p>Seu patrimônio total ${totalQueda < P ? "cai" : "fica em"} <b class="perda">${pct(((totalQueda - P) / P) * 100 || 0, 1)}</b>.</p></div>
    <div class="cenario bom"><span class="kpi-rotulo">Se subir ${pct(a * 100, 0)}</span><span class="kpi-valor">${brl0(totalAlta)}</span>
      <p>Seu patrimônio total sobe <b class="ganho">${pct(((totalAlta - P) / P) * 100 || 0, 1, true)}</b>.</p></div>
    <div class="cenario amplo"><span class="kpi-rotulo">Em cripto</span><span class="kpi-valor">${brl0(emCripto)}</span>
      <p>Depois de uma queda de ${pct(-q * 100, 0)}, a cripto precisa subir <b>${Number.isFinite(recuperar) ? pct(recuperar, 0, true) : "∞"}</b> só para voltar ao valor inicial. Regra prática: coloque em cripto só o que você aceitaria ver cair 80% sem mudar seus planos.</p></div>`;
}

RENDER.cripto = renderCripto;

async function carregarCripto() {
  estado.criptoErro = false;
  if (rotaAtual === "cripto") renderTabelaCripto();
  try {
    estado.cripto = await Live.cripto();
  } catch {
    estado.cripto = null;
    estado.criptoErro = true;
  }
  renderFita();
  if (rotaAtual === "cripto") renderTabelaCripto();
}

// ============ RENDA FIXA ============
function atualizarSimulador() {
  const meses = Math.max(1, Math.min(600, Math.round(num("meses"))));
  const base = { inicial: num("inicial"), mensal: num("mensal"), meses, inflacao: num("ipca") / 100 };
  const lista = Calc.produtos({ selic: num("selic") / 100, cdi: num("cdi") / 100, pctCdb: num("pctCdb") / 100, pctLci: num("pctLci") / 100 });
  const cores = ["--s0", "--s1", "--s2", "--s3"];
  const res = lista.map((p, i) => ({ ...p, cor: css(cores[i]), r: Calc.simular({ ...base, ...p }) }));
  const melhor = res.reduce((a, b) => (b.r.liquido > a.r.liquido ? b : a));
  $("prazo-txt").textContent = textoPrazo(meses);
  $("total-investido").textContent = brl(res[0].r.investido);
  $("tabela-res").innerHTML = res.map((p) => `<tr class="${p === melhor ? "melhor" : ""}">
      <td><span class="nome-classe"><span class="ponto" style="background:${p.cor}"></span>${esc(p.nome)}</span></td>
      <td>${brl(p.r.bruto)}</td><td>${brl(p.r.ir)}</td><td>${brl(p.r.liquido)}</td><td>${brl(p.r.lucroLiquido)}</td>
      <td class="${p.r.real < p.r.investido ? "perda" : ""}">${brl(p.r.real)}</td></tr>`).join("");
  $("legenda").innerHTML = res.map((p) => `<span><i class="traco" style="background:${p.cor}"></i>${esc(p.nome)}</span>`).join("") +
    `<span><i class="traco" style="background:${css("--tinta-3")};opacity:.6"></i>Valor investido</span>`;
  const ev = res[0].r.evolucao;
  Charts.linhas($("grafico"), {
    altura: 260, x: ev.map((e) => e.mes), xTicks: 5, yFmt: brlC, rotulo: "Evolução do saldo bruto",
    xFmt: (m) => (m === 0 ? "hoje" : m + " m"), xTooltip: (m) => (m === 0 ? "Hoje" : `Mês ${m}`),
    series: [
      { nome: "Investido", cor: css("--tinta-3"), valores: ev.map((e) => e.investido), tracejado: true, largura: 1.5 },
      ...res.map((p) => ({ nome: p.nome, cor: p.cor, valores: p.r.evolucao.map((e) => e.saldo) })),
    ],
    linhasTooltip: (i) => [...res.map((p) => ({ cor: p.cor, nome: p.nome, valor: brl(p.r.evolucao[i].saldo) })), { cor: css("--tinta-3"), nome: "Investido", valor: brl(ev[i].investido) }],
  });
}

function atualizarReserva() {
  const r = Calc.reservaEmergencia(num("gastos"), $("perfil-trab").value);
  $("res-reserva").innerHTML = `Sua reserva ideal<span class="grande">${brl0(r.valor)}</span>${r.meses} meses de gastos, em Tesouro Selic ou CDB com liquidez diária.`;
}
function atualizarMeta() {
  const m = Calc.mesesParaMeta({ inicial: num("meta-inicial"), mensal: num("meta-mensal"), alvo: num("alvo"), taxaAnual: num("meta-taxa") / 100 });
  $("res-meta").innerHTML = m === null ? "Com esses valores a meta levaria mais de 100 anos. Aumente o aporte."
    : m === 0 ? "Você já atingiu essa meta." : `Você chega lá em<span class="grande">${textoPrazo(m)}</span>`;
}

RENDER["renda-fixa"] = () => { atualizarSimulador(); atualizarReserva(); atualizarMeta(); };

async function carregarTaxas() {
  const status = $("status-taxas");
  status.className = "status";
  status.textContent = "Buscando taxas no Banco Central…";
  let r = {};
  try { r = await Live.bancoCentral(); } catch { r = {}; }
  estado.bcb = r;
  const ok = ["selic", "cdi", "ipca"].filter((k) => r[k]);
  ok.forEach((k) => ($(k).value = r[k].valor.toFixed(2)));
  if (!ok.length) {
    status.textContent = "Sem conexão com o Banco Central aqui. Usando os valores digitados (edite com as taxas atuais).";
  } else {
    status.className = "status ok";
    status.textContent = `Taxas do Banco Central de ${r[ok[0]].data}${ok.length < 3 ? " (algumas não carregaram)" : ""}.`;
  }
  aoMudarMercado();
}

function aoMudarMercado() {
  estado.mercadoManual = mercado();
  gravar();
  renderFita();
  renderFonte();
  if (rotaAtual) RENDER[rotaAtual]?.();
}

// ============ ONDE INVESTIR ============
const FILTROS = [
  { id: "todos", nome: "Todos", ok: () => true },
  { id: "baixo", nome: "Risco baixo", ok: (r) => r <= 2 },
  { id: "medio", nome: "Risco médio", ok: (r) => r === 3 },
  { id: "alto", nome: "Risco alto", ok: (r) => r === 4 },
  { id: "muito-alto", nome: "Risco muito alto", ok: (r) => r === 5 },
];
let filtroAtual = "todos";
function renderCatalogo() {
  $("filtro-risco").innerHTML = FILTROS.map((f) => {
    const qtd = Dados.INSTRUMENTOS.filter((i) => f.ok(i.risco)).length;
    return `<button type="button" class="filtro" data-f="${f.id}" aria-pressed="${f.id === filtroAtual}">${f.nome} · ${qtd}</button>`;
  }).join("");
  const f = FILTROS.find((x) => x.id === filtroAtual);
  $("catalogo").innerHTML = Dados.INSTRUMENTOS.filter((i) => f.ok(i.risco)).sort((a, b) => a.risco - b.risco).map((i) => `
    <article class="painel inst">
      <div class="inst-topo"><h3>${esc(i.nome)}</h3></div>
      <div class="inst-topo">${medidorRisco(i.risco)}<span class="inst-classe"><span class="ponto" style="background:${corClasse(i.classe)}"></span>${esc(curtoClasse(i.classe))}</span></div>
      <dl><dt>Para quem</dt><dd>${esc(i.para)}</dd><dt>Liquidez</dt><dd>${esc(i.liquidez)}</dd><dt>IR</dt><dd>${esc(i.ir)}</dd><dt>Mínimo</dt><dd>${esc(i.minimo)}</dd></dl>
      <p class="cuidado"><b>Cuidado:</b> ${esc(i.cuidado)}</p>
    </article>`).join("");
}
RENDER["onde-investir"] = renderCatalogo;

// ============ CARTEIRA ============
function renderCarteira() {
  const { total, porClasse } = alocacaoCarteira();
  const pf = Dados.PERFIS[perfilAtual()];
  $("aviso-exemplo").hidden = !estado.carteira.exemplo;
  $("total-carteira").textContent = brl0(total);
  $("cart-alvo-nota").textContent = `Barra: quanto você tem. Marcador: alvo da carteira ${pf.nome.toLowerCase()}${estado.perfil.id ? " (seu perfil)" : " (faça o questionário para personalizar)"}.`;
  Charts.rosca($("g-cart"), [...IDS, "outros"].filter((id) => porClasse[id]).map((id) => ({ nome: curtoClasse(id), valor: porClasse[id], cor: corClasse(id) })),
    { valor: brlC(total), rotulo: "total" });
  $("cart-comparacao").innerHTML = [...IDS, ...(porClasse.outros ? ["outros"] : [])].map((id) => {
    const atual = total ? ((porClasse[id] || 0) / total) * 100 : 0;
    const alvo = pf.alocacao[id] ?? 0;
    return `<div class="cmp"><span class="cmp-nome"><span class="ponto" style="background:${corClasse(id)}"></span>${esc(curtoClasse(id))}</span>
      <span class="cmp-barra"><i style="width:${Math.min(100, atual)}%;background:${corClasse(id)}"></i>${id !== "outros" ? `<b style="left:calc(${alvo}% - 1px)" title="Alvo ${pct(alvo, 0)}"></b>` : ""}</span>
      <span class="cmp-v">${pct(atual, 0)} / ${id !== "outros" ? pct(alvo, 0) : "—"}</span></div>`;
  }).join("");

  $("lista-ativos").innerHTML = estado.carteira.itens.length
    ? estado.carteira.itens.map((a, i) => `<li>
        <span class="ponto" style="background:${corClasse(a.classe)}"></span>
        <span class="nome">${esc(a.nome)}<br /><span class="cat">${esc(nomeClasse(a.classe))} · ${pct(total ? (a.valor / total) * 100 : 0)}</span></span>
        <span class="valor">${brl(a.valor)}</span>
        <button type="button" data-remover="${i}" aria-label="Remover ${esc(a.nome)}">✕</button></li>`).join("")
    : `<li class="vazio-estado">Nenhum investimento ainda. Use o formulário para adicionar o primeiro.</li>`;
  renderAporte();
}

function renderAporte() {
  const { porClasse } = alocacaoCarteira();
  const pf = Dados.PERFIS[perfilAtual()];
  const aporte = num("aporte-valor");
  const atual = {};
  IDS.forEach((id) => (atual[id] = porClasse[id] || 0));
  const div = Calc.rebalancear(atual, pf.alocacao, aporte);
  const itens = Object.entries(div).filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]);
  $("res-aporte").innerHTML = aporte
    ? `<p class="nota">Para aproximar sua carteira do alvo ${pf.nome.toLowerCase()}:</p><ul class="aporte-lista">${itens.map(([id, v]) =>
      `<li><span class="ponto" style="background:${corClasse(id)}"></span><span>${esc(nomeClasse(id))}</span><b>${brl0(v)}</b></li>`).join("")}</ul>`
    : `<p class="nota">Informe o valor do aporte.</p>`;
}
RENDER.carteira = renderCarteira;

// ============ Diálogo de fontes ============
function abrirFonte() {
  const b = estado.bcb || {};
  const linha = (nome, s) => `<li><b>${nome}:</b> ${s ? `ao vivo (${s.data})` : "valor manual"}</li>`;
  $("fonte-detalhe").innerHTML = `
    <p class="nota">Taxas atuais vêm da API do Banco Central quando o navegador permite. Se não, valem os números da aba Renda fixa, que você pode editar.</p>
    <ul>${linha("Selic", b.selic)}${linha("CDI", b.cdi)}${linha("IPCA 12 meses", b.ipca)}${linha("Dólar", b.dolar)}
    <li><b>Cripto:</b> ${estado.cripto ? "ao vivo (CoinGecko)" : "indisponível aqui"}</li>
    <li><b>Histórico 2016–2024:</b> retornos anuais aproximados de BCB, IBGE, Anbima (IMA-B), B3 (Ibovespa, IFIX) e S&amp;P, com ativos em dólar convertidos para reais.</li>
    <li><b>Projeção:</b> premissas de retorno e volatilidade editáveis na aba Projeção.</li></ul>`;
  $("dialogo-fonte").hidden = false;
  $("fechar-fonte").focus();
}

// ============ Eventos ============
function ligarEventos() {
  $("fonte-dados").addEventListener("click", abrirFonte);
  $("fechar-fonte").addEventListener("click", () => ($("dialogo-fonte").hidden = true));
  $("dialogo-fonte").addEventListener("click", (e) => { if (e.target.id === "dialogo-fonte") e.target.hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("dialogo-fonte").hidden = true; });
  document.querySelectorAll("form").forEach((f) => f.addEventListener("submit", (e) => e.preventDefault()));

  // Projeção
  $("form-proj").addEventListener("input", (e) => {
    if (e.target.matches("input[type=range][data-id]")) {
      pesosPersonalizados[e.target.dataset.id] = +e.target.value;
      $("pwv-" + e.target.dataset.id).textContent = pct(+e.target.value, 0);
      const soma = IDS.reduce((s, id) => s + (pesosPersonalizados[id] || 0), 0);
      const t = $("pw-total");
      t.textContent = `Total: ${pct(soma, 0)}${soma !== 100 ? " (a projeção normaliza para 100%)" : ""}`;
      t.classList.toggle("erro", soma !== 100);
    }
    agendarProjecao();
  });
  $("pj-carteira").addEventListener("change", () => {
    renderPesos();
    agendarProjecao();
  });
  $("tab-premissas").addEventListener("change", (e) => {
    const { id, campo } = e.target.dataset;
    if (!id) return;
    estado.premissas[id] = { ...(estado.premissas[id] || {}), [campo]: Math.max(campo === "vol" ? 0 : -50, parseFloat(e.target.value) || 0) };
    gravar();
    agendarProjecao();
  });
  $("pj-restaurar").addEventListener("click", () => { estado.premissas = {}; gravar(); renderPremissas(); agendarProjecao(); });

  // Histórico
  $("form-hist").addEventListener("input", renderHistorico);

  // Cripto
  $("form-cripto").addEventListener("input", renderSimCripto);
  $("cr-atualizar").addEventListener("click", carregarCripto);

  // Renda fixa
  $("form-sim").addEventListener("input", (e) => {
    if (["selic", "cdi", "ipca"].includes(e.target.id)) aoMudarMercado();
    else atualizarSimulador();
  });
  $("btn-taxas").addEventListener("click", carregarTaxas);
  $("form-reserva").addEventListener("input", atualizarReserva);
  $("form-meta").addEventListener("input", atualizarMeta);

  // Onde investir
  $("filtro-risco").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    filtroAtual = b.dataset.f;
    renderCatalogo();
  });

  // Carteira
  $("ativo-cat").innerHTML = [...CLASSES.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`), `<option value="outros">Outros</option>`].join("");
  $("form-ativo").addEventListener("submit", (e) => {
    const nome = $("ativo-nome").value.trim();
    const valor = parseFloat($("ativo-valor").value);
    if (!nome || !(valor > 0)) return;
    if (estado.carteira.exemplo) estado.carteira = { itens: [], exemplo: false };
    estado.carteira.itens.push({ nome, classe: $("ativo-cat").value, valor });
    gravar();
    renderCarteira();
    e.target.reset();
    $("ativo-nome").focus();
  });
  $("lista-ativos").addEventListener("click", (e) => {
    const i = e.target.closest("[data-remover]")?.dataset.remover;
    if (i === undefined) return;
    estado.carteira.itens.splice(+i, 1);
    estado.carteira.exemplo = false;
    gravar();
    renderCarteira();
  });
  $("limpar-exemplo").addEventListener("click", () => { estado.carteira = { itens: [], exemplo: false }; gravar(); renderCarteira(); $("ativo-nome").focus(); });
  $("form-aporte").addEventListener("input", renderAporte);
}

// ============ Início ============
(function iniciar() {
  if (estado.mercadoManual) {
    ["selic", "cdi", "ipca"].forEach((k) => { if (estado.mercadoManual[k]) $(k).value = estado.mercadoManual[k]; });
  }
  montarQuestionario();
  montarHistorico();
  ligarEventos();
  if (estado.perfil.id) $("pj-carteira").value = estado.perfil.id;
  else $("pj-carteira").value = "moderado";
  renderFita();
  renderFonte();
  irPara(location.hash.slice(1) || "visao", false);
  carregarTaxas();
  carregarCripto();
})();
