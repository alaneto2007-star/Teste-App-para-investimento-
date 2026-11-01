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
// Botão "?" que abre a explicação de um termo do glossário.
const termo = (id) => {
  const g = Dados.GLOSSARIO[id];
  return g ? `<button type="button" class="termo" data-termo="${id}" aria-label="O que é ${esc(g.termo)}?" aria-expanded="false">?</button>` : "";
};
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
// Tudo o que o usuário preenche: é o que fica salvo no navegador e o que vai no código de backup.
function dadosParaSalvar() {
  return {
    perfil: estado.perfil, carteira: estado.carteira, premissasReais: estado.premissas, mercado: estado.mercadoManual,
    produtosRF: estado.produtosRF, plataformas: estado.plataformas, objetivo: estado.objetivo, visitas: estado.visitas,
  };
}
function gravar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dadosParaSalvar()));
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
    // As premissas da primeira versão eram nominais; as atuais são reais. Por isso a chave mudou.
    premissas: salvo.premissasReais || {},
    // Produtos salvos em versões anteriores ganham os campos novos (app, emissor, custódia).
    produtosRF: (Array.isArray(salvo.produtosRF) && salvo.produtosRF.length ? salvo.produtosRF : Dados.PRODUTOS_RF)
      .map((p) => ({ plataforma: "", emissor: "", custodia: 0, ...p })),
    plataformas: salvo.plataformas || {}, // custos dos apps editados pelo usuário
    objetivo: salvo.objetivo || "reserva", // objetivo escolhido na aba Apps e corretoras
    tesouro: null, // taxas do Tesouro Direto (data/tesouro.json)
    visitas: salvo.visitas || {}, // abas já abertas (para o "Comece por aqui")
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
// Premissas reais por classe. A renda fixa pós segue o juro real de longo prazo da aba Projeção.
function juroRealLongo() {
  const v = parseFloat($("pj-juroreal").value);
  return Number.isFinite(v) ? v : Dados.JURO_REAL_PADRAO;
}
function premissas() {
  const p = {};
  IDS.forEach((id) => (p[id] = { ...Dados.PREMISSAS[id], ...(estado.premissas[id] || {}) }));
  p.cdi = { ...p.cdi, ret: juroRealLongo() };
  return p;
}
function perfilAtual() {
  return estado.perfil.id || "moderado";
}

// ============ Navegação ============
const ROTAS = ["visao", "perfil", "projecao", "historico", "cripto", "renda-fixa", "onde-investir", "apps", "carteira", "manual"];
const RENDER = {};
let rotaAtual = null;
function irPara(rota, rolar) {
  if (!ROTAS.includes(rota)) rota = "visao";
  rotaAtual = rota;
  fecharBalao();
  if (!estado.visitas[rota]) { estado.visitas[rota] = true; gravar(); }
  ROTAS.forEach((r) => ($("v-" + r).hidden = r !== rota));
  document.querySelectorAll(".menu a").forEach((a) => {
    if (a.dataset.rota === rota) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.querySelector(`.menu a[data-rota="${rota}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  RENDER[rota]?.();
  tecladoNumerico();
  if (rolar) window.scrollTo({ top: 0 });
}

// No celular, abre o teclado numérico com vírgula nos campos de número.
function tecladoNumerico() {
  document.querySelectorAll('input[type="number"]:not([inputmode])').forEach((i) => i.setAttribute("inputmode", "decimal"));
}

function aplicarTema(claro) {
  if (claro) document.documentElement.dataset.tema = "claro";
  else delete document.documentElement.dataset.tema;
  $("btn-tema").setAttribute("aria-label", claro ? "Mudar para o tema preto" : "Mudar para o tema claro");
  try { localStorage.setItem("invest-simulador:tema", claro ? "claro" : "preto"); } catch { /* sem armazenamento */ }
  renderFita();
  if (rotaAtual) RENDER[rotaAtual]?.();
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
  const ipcaLongo = tituloMaisProximo("ipca", 120);
  if (ipcaLongo) itens.push([`IPCA+ ${ipcaLongo.vencimento.slice(-4)}`, `IPCA + ${pct(ipcaLongo.taxa, 2)}`]);
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
        <p class="nota" style="margin-top:10px">Retorno real esperado ${pct(est.ret)} a.a. acima da inflação · volatilidade ${pct(est.vol)}</p>
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
    xRotulo: "Volatilidade anual (risco)", yRotulo: "Retorno real ao ano", rotulo: "Mapa de risco e retorno",
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

// "Comece por aqui": passos do plano, marcados conforme o que o usuário já fez.
function passosComeco() {
  const { porClasse } = alocacaoCarteira();
  const reservaIdeal = Calc.reservaEmergencia(num("gastos"), $("perfil-trab").value).valor;
  const carteiraPropria = !estado.carteira.exemplo && estado.carteira.itens.length > 0;
  const ofertasProprias = estado.produtosRF.some((p) => {
    const d = Dados.PRODUTOS_RF.find((x) => x.id === p.id);
    return !d || d.pct !== p.pct || d.plataforma !== p.plataforma || d.teto !== p.teto || d.nome !== p.nome;
  });
  return [
    { feito: !!estado.perfil.id, titulo: "Descubra seu perfil", texto: "6 perguntas para saber quanto risco faz sentido para você.", rota: "perfil" },
    { feito: carteiraPropria && reservaIdeal > 0 && (porClasse.cdi || 0) >= reservaIdeal, titulo: "Monte a reserva de emergência",
      texto: `Sua reserva ideal é de ${brl0(reservaIdeal)} (calcule na aba Renda fixa). Ela vem antes de qualquer investimento com risco.`, rota: "renda-fixa" },
    { feito: ofertasProprias, titulo: "Cadastre as ofertas dos seus apps", texto: "As taxas que você vê no Nubank, no Inter, na XP… para o hub comparar.", rota: "renda-fixa" },
    { feito: !!estado.visitas.apps, titulo: "Veja onde aplicar", texto: "O melhor app e o melhor produto para cada objetivo.", rota: "apps" },
    { feito: carteiraPropria, titulo: "Registre sua carteira", texto: "Para o hub dizer como dividir o próximo aporte.", rota: "carteira" },
    { feito: !!estado.visitas.manual, titulo: "Leia o manual", texto: "Como cada investimento faz o seu dinheiro crescer.", rota: "manual" },
  ];
}

function renderComecePorAqui() {
  const passos = passosComeco();
  const feitos = passos.filter((p) => p.feito).length;
  const prox = passos.find((p) => !p.feito);
  $("comece").innerHTML = `
    <div class="painel-cabeca"><div>
      <p class="sobre">Comece por aqui</p>
      <h2>${prox ? `Seu plano em ${passos.length} passos` : "Tudo pronto"}</h2>
      <p class="nota">${prox ? `${feitos} de ${passos.length} feitos. Próximo passo: ${prox.titulo.toLowerCase()}.` : "Volte uma vez por mês para atualizar a carteira e ver onde aplicar o próximo aporte."}</p>
    </div></div>
    <div class="progresso" role="progressbar" aria-label="Passos feitos" aria-valuemin="0" aria-valuemax="${passos.length}" aria-valuenow="${feitos}"><i style="width:${(feitos / passos.length) * 100}%"></i></div>
    <ol class="comece">${passos.map((p, i) => `
      <li class="${p.feito ? "feito" : ""}${p === prox ? " proximo" : ""}">
        <span class="marca-passo" aria-hidden="true">${p.feito ? "✓" : i + 1}</span>
        <span class="passo-texto"><b>${esc(p.titulo)}</b><span class="visualmente-oculto">${p.feito ? " (feito)" : " (pendente)"}</span><span class="sub">${esc(p.texto)}</span></span>
        <a class="botao pequeno${p === prox ? "" : " fantasma"}" href="#${p.rota}">${p.feito ? "Rever" : "Fazer agora"}</a>
      </li>`).join("")}</ol>`;
}

RENDER.visao = () => { renderComecePorAqui(); renderCartaoPerfil(); renderCartaoCarteira(); renderMapa(); renderTabelaClasses(); };

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
      <div class="kpi"><span class="kpi-rotulo">Retorno real esperado</span><span class="kpi-valor">${pct(est.ret)}</span><span class="kpi-sub">ao ano, acima da inflação</span></div>
      <div class="kpi"><span class="kpi-rotulo">Volatilidade</span><span class="kpi-valor">${pct(est.vol)}</span><span class="kpi-sub">oscilação típica em 1 ano</span></div>
    </div>
    <p class="nota" style="margin-top:12px">Carteira educativa, não é recomendação. Ajuste à sua realidade.</p>
    <div class="acoes"><a class="botao" href="#projecao">Projetar esta carteira</a><a class="botao fantasma" href="#onde-investir">Onde investir</a></div>`;
  Charts.rosca($("g-perfil"), IDS.map((c) => ({ nome: curtoClasse(c), valor: pf.alocacao[c], cor: corClasse(c) })), { valor: pct(est.ret, 1), rotulo: "real ao ano" });
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

// A projeção roda num Web Worker quando possível, para a tela não travar enquanto você digita.
// Se o worker não existir (arquivo aberto do computador) ou não responder, calcula aqui mesmo.
let workerProj = null, workerConfirmado = false, pedidoProj = 0, pendenteProj = null, timerWorker = null;
function iniciarWorkerProjecao() {
  try {
    workerProj = new Worker("js/projecao-worker.js");
  } catch {
    workerProj = null;
    return;
  }
  workerProj.onmessage = (e) => {
    const { id, r, erro } = e.data || {};
    workerConfirmado = true;
    clearTimeout(timerWorker);
    if (!pendenteProj || id !== pendenteProj.id) return; // resposta de um pedido antigo
    const p = pendenteProj;
    pendenteProj = null;
    if (erro) p.local();
    else desenharProjecao(r, p.ctx);
  };
  workerProj.onerror = (e) => {
    e.preventDefault?.();
    desligarWorker();
  };
}
function desligarWorker() {
  clearTimeout(timerWorker);
  try { workerProj?.terminate(); } catch { /* já encerrado */ }
  workerProj = null;
  const p = pendenteProj;
  pendenteProj = null;
  p?.local();
}

function rodarProjecao() {
  const anos = Math.max(1, Math.min(40, Math.round(num("pj-anos")) || 1));
  const { aloc } = alocacaoProjecao();
  const inflacao = num("pj-inflacao");
  const descontarIR = $("pj-ir").checked;
  const m = mercado();
  const hoje = Calc.juroReal(m.selic / 100, m.ipca / 100) * 100;
  const refIpca = tituloMaisProximo("ipca", anos * 12);
  $("pj-juroreal-dica").textContent = `Hoje: ${pct(hoje)} (Selic menos IPCA). Média das últimas duas décadas: cerca de 4,5%.` +
    (refIpca ? ` O ${refIpca.nome} garante hoje IPCA + ${pct(refIpca.taxa, 2)} para quem ficar até o vencimento.` : " Juros altos assim costumam não durar.");
  const params = {
    alocacao: aloc, premissas: premissas(), ids: IDS, correlacao: Dados.CORRELACAO,
    inicial: num("pj-inicial"), mensal: num("pj-mensal"), anos, inflacao, descontarIR, sims: anos > 20 ? 1200 : 2000,
  };
  const ctx = { anos, inflacao, descontarIR };
  const id = ++pedidoProj;
  const local = () => { if (id === pedidoProj) desenharProjecao(Calc.monteCarlo(params), ctx); };
  if (!workerProj) return local();
  pendenteProj = { id, ctx, local };
  workerProj.postMessage({ id, params });
  if (!workerConfirmado) {
    clearTimeout(timerWorker);
    timerWorker = setTimeout(desligarWorker, 3000);
  }
}

function desenharProjecao(r, { anos, inflacao, descontarIR }) {
  $("g-proj").style.opacity = 1;
  const anoFim = new Date().getFullYear() + anos;
  const liq = descontarIR ? "líquido, " : "";
  $("pj-kpis").innerHTML = `
    <div class="kpi principal"><span class="kpi-rotulo">Cenário mediano ${termo("mediana")}</span><span class="kpi-valor">${brl0(r.final.p50)}</span><span class="kpi-sub">${liq}em reais de hoje · ≈ ${brlC(r.final.p50 * r.deflator)} em valores de ${anoFim}</span></div>
    <div class="kpi"><span class="kpi-rotulo">Cenário ruim (5%)</span><span class="kpi-valor">${brl0(r.final.p5)}</span><span class="kpi-sub">95% dos cenários terminam acima</span></div>
    <div class="kpi"><span class="kpi-rotulo">Cenário bom (95%)</span><span class="kpi-valor">${brl0(r.final.p95)}</span><span class="kpi-sub">só 5% terminam acima</span></div>
    <div class="kpi"><span class="kpi-rotulo">Abaixo do investido</span><span class="kpi-valor ${r.probPerda > 0.05 ? "perda" : ""}">${pct(r.probPerda * 100, 1)}</span><span class="kpi-sub">chance de perder poder de compra</span></div>
    <div class="kpi"><span class="kpi-rotulo">Imposto no resgate</span><span class="kpi-valor">${descontarIR ? brl0(r.irMediano) : "não descontado"}</span><span class="kpi-sub">${descontarIR ? `${pct(r.aliquota * 100)} sobre o ganho nominal` : "marque a opção ao lado"} · custos de ${pct(r.custoMedio, 2)} a.a.</span></div>
    <div class="kpi"><span class="kpi-rotulo">Queda típica no caminho</span><span class="kpi-valor perda">${pct(r.quedaMediana * 100, 0)}</span><span class="kpi-sub">pior 5%: ${pct(r.quedaRuim * 100, 0)}</span></div>`;
  $("pj-legenda-nota").textContent = `Em reais de hoje. Investido: ${brl0(r.investido)}, com aportes corrigidos pela inflação de ${pct(inflacao)} a.a. Retorno real esperado da carteira: ${pct(r.retornoEsperado)} a.a., antes de custos e IR.`;
  const ac = css("--acento");
  $("pj-legenda").innerHTML = `<span><i class="traco" style="background:${ac}"></i>Mediana</span><span><i class="faixa" style="background:${ac};opacity:.35"></i>50% dos cenários</span><span><i class="faixa" style="background:${ac};opacity:.15"></i>90% dos cenários</span><span><i class="traco" style="background:${css("--tinta-3")}"></i>Investido</span>`;
  const s = r.serie;
  Charts.linhas($("g-proj"), {
    altura: 320, x: s.map((p) => p.mes), xTicks: Math.min(anos + 1, 6),
    xFmt: (mes) => (mes === 0 ? "hoje" : Math.round(mes / 12) + (Math.round(mes / 12) === 1 ? " ano" : " anos")),
    xTooltip: (mes) => mes === 0 ? "Hoje" : `Após ${textoPrazo(mes)}`,
    yFmt: brlC, rotulo: "Projeção do patrimônio em reais de hoje",
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
  const campo = (c, nome, passo, extra = "") =>
    `<td><input type="number" step="${passo}" id="pm-${nome}-${c.id}" data-id="${c.id}" data-campo="${nome}" value="${p[c.id][nome]}" ${extra} aria-label="${nome} de ${esc(c.nome)}" /></td>`;
  $("tab-premissas").innerHTML = `<thead><tr><th>Classe</th><th>Retorno real a.a.</th><th>Volatilidade ${termo("volatilidade")}</th><th>Custo a.a.</th><th>IR no resgate</th></tr></thead><tbody>` +
    CLASSES.map((c) => `<tr>
      <td><span class="nome-classe"><span class="ponto" style="background:${corClasse(c.id)}"></span>${esc(c.nome)}</span></td>
      ${campo(c, "ret", 0.5, c.id === "cdi" ? 'disabled title="Segue o juro real de longo prazo"' : "")}
      ${campo(c, "vol", 0.5, 'min="0"')}${campo(c, "custo", 0.05, 'min="0"')}${campo(c, "ir", 0.5, 'min="0" max="30"')}
    </tr>`).join("") + "</tbody>";
  tecladoNumerico();
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
  const liquido = $("ht-custos").checked;
  const log = $("ht-log").checked;
  const pr = premissas();
  const inicial = num("ht-inicial"), mensal = num("ht-mensal");
  const marcados = [...$("ht-classes").querySelectorAll("input[type=checkbox]:checked")].map((i) => i.value).filter((v) => v !== "on");
  const historicos = {};
  CLASSES.forEach((c) => (historicos[c.id] = c.hist.slice(desde)));
  const pf = Dados.PERFIS[perfilAtual()];

  const linhas = marcados.map((id) => {
    const rets = id === "carteira" ? Calc.retornosCarteira(pf.alocacao, historicos) : historicos[id];
    // Custo e alíquota de IR: da classe, ou a média ponderada pela carteira.
    const media = (campo) => IDS.reduce((s, c) => s + (pf.alocacao[c] / 100) * pr[c][campo], 0);
    const custo = liquido ? (id === "carteira" ? media("custo") : pr[id].custo) : 0;
    const aliq = liquido ? (id === "carteira" ? media("ir") : pr[id].ir) / 100 : 0;
    const pts = Calc.backtest({ retornosPct: rets, inicial, mensal, inflacaoPct: ipca, custoPct: custo });
    const ult = pts.at(-1);
    const ir = aliq * Math.max(0, ult.saldo - ult.investido);
    return {
      id, rets, pts, ir, aliq,
      liquidoFinal: (ult.saldo - ir) / (real ? ult.deflator : 1),
      retsLiq: rets.map((r) => ((1 + r / 100) * (1 - custo / 100) - 1) * 100),
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
  $("ht-nota").textContent = `${brl0(inicial)} no início e ${brl0(mensal)} por mês, de janeiro de ${inicio} a dezembro de 2024.` +
    (liquido ? " Custos anuais já descontados nas linhas; IR do resgate na tabela." : " Sem custos nem IR.") +
    (log ? " Escala logarítmica: cada linha de grade é um múltiplo do valor." : "");
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

  const ordenadas = [...linhas].sort((a, b) => b.liquidoFinal - a.liquidoFinal);
  const sufixo = real ? ` (reais de ${inicio})` : "";
  $("tab-hist").innerHTML = `<thead><tr><th>Opção</th><th>Valor final${sufixo}</th>${liquido ? "<th>IR no resgate</th><th>Líquido</th>" : ""}<th>Ao ano</th><th>Pior ano</th><th>Maior queda</th></tr></thead><tbody>` +
    ordenadas.map((l, i) => {
      const e = Calc.estatisticas(l.retsLiq);
      const fator = real ? l.pts.at(-1).deflator : 1;
      return `<tr class="${i === 0 ? "melhor" : ""}">
        <td><span class="nome-classe"><span class="ponto" style="background:${l.cor}"></span>${esc(l.nome)}</span></td>
        <td>${brl0(l.valores.at(-1))}</td>
        ${liquido ? `<td>${l.ir > 0 ? "−" + brl0(l.ir / fator) : brl0(0)}</td><td><b>${brl0(l.liquidoFinal)}</b></td>` : ""}
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
const TIPOS_RF = { cdi: "% do CDI", selic: "% da Selic", prefixado: "Prefixado", ipca: "IPCA + taxa", poupanca: "Poupança" };
const ROTULO_TAXA = { cdi: "Taxa (% do CDI)", selic: "Taxa (% da Selic)", prefixado: "Taxa (% ao ano)", ipca: "Acima do IPCA (% a.a.)", poupanca: "Taxa (regra da poupança)" };
const mktRF = () => ({ cdi: num("cdi") / 100, selic: num("selic") / 100, ipca: num("ipca") / 100 });
const corProduto = (i) => css(`--s${(i % 8) + 1}`);
const produtosValidos = () => estado.produtosRF.filter((p) => p.nome.trim() && (p.tipo === "poupanca" || p.pct > 0));
const PLATAFORMAS = Dados.PLATAFORMAS;
const plataforma = (id) => PLATAFORMAS.find((p) => p.id === id);

// Onde comprar o produto: o app cadastrado ou uma indicação genérica.
function ondeComprar(p) {
  if (p.plataforma && plataforma(p.plataforma)) return plataforma(p.plataforma).nome;
  if (p.emissor === Dados.TESOURO_EMISSOR) return "Tesouro Direto, em qualquer corretora";
  if (p.tipo === "poupanca") return "Qualquer banco";
  return "Qualquer banco ou corretora";
}

function descricaoProduto(p) {
  const taxa = { poupanca: "Regra da poupança", prefixado: `${pct(p.pct, 2)} ao ano`, ipca: `IPCA + ${pct(p.pct, 2)}`, selic: `${pct(p.pct, 0)} da Selic` }[p.tipo] ?? `${pct(p.pct, 0)} do CDI`;
  const partes = [taxa];
  if (p.isento) partes.push("isento de IR");
  if (p.teto > 0) partes.push(`até ${brl0(p.teto)}; acima, ${pct(p.pctAcima, 0)} do CDI`);
  if (p.vencimento) partes.push(`vence em ${p.vencimento.slice(3)}`);
  else if (p.carencia > 0) partes.push(`carência de ${p.carencia} meses`);
  if (p.custodia > 0) partes.push(`custódia de ${pct(p.custodia, 2)} a.a.`);
  return partes.join(" · ");
}

function opcoesPlataforma(sel) {
  const grupos = Object.entries(Dados.TIPOS_PLATAFORMA).map(([tipo, nome]) =>
    `<optgroup label="${nome}">${PLATAFORMAS.filter((p) => p.tipo === tipo).map((p) => `<option value="${p.id}" ${sel === p.id ? "selected" : ""}>${esc(p.nome)}</option>`).join("")}</optgroup>`).join("");
  return `<option value="" ${!sel ? "selected" : ""}>Qualquer banco ou corretora</option>${grupos}`;
}

// Editor de ofertas em cartões (cabe no celular e no computador).
function renderProdutos() {
  $("tab-produtos").innerHTML = estado.produtosRF.map((p, i) => {
    const id = (c) => `rf-${i}-${c}`;
    const campo = (c, rotulo, controle) => `<label for="${id(c)}">${rotulo}${controle}</label>`;
    const numero = (c, extra = "") => `<input type="number" id="${id(c)}" data-i="${i}" data-campo="${c}" value="${p[c] ?? 0}" min="0" ${extra} />`;
    return `<div class="oferta">
      <div class="oferta-topo">
        <span class="ponto" style="background:${corProduto(i)}"></span>
        <input type="text" class="oferta-nome" id="${id("nome")}" data-i="${i}" data-campo="nome" value="${esc(p.nome)}" aria-label="Nome do produto" />
        <button type="button" data-remover-rf="${i}" aria-label="Remover ${esc(p.nome)}">✕</button>
      </div>
      <div class="oferta-campos">
        ${campo("plataforma", "App", `<select id="${id("plataforma")}" data-i="${i}" data-campo="plataforma">${opcoesPlataforma(p.plataforma)}</select>`)}
        ${campo("emissor", `Emissor (para o FGC) ${termo("fgc")}`, `<input type="text" id="${id("emissor")}" data-i="${i}" data-campo="emissor" value="${esc(p.emissor || "")}" placeholder="Ex.: Banco Inter" />`)}
        ${campo("tipo", "Índice", `<select id="${id("tipo")}" data-i="${i}" data-campo="tipo">${Object.entries(TIPOS_RF).map(([k, v]) => `<option value="${k}" ${p.tipo === k ? "selected" : ""}>${v}</option>`).join("")}</select>`)}
        ${campo("pct", ROTULO_TAXA[p.tipo] || "Taxa", numero("pct", `step="0.01" ${p.tipo === "poupanca" ? "disabled" : ""}`))}
        ${campo("teto", `Teto (R$; 0 = sem teto) ${termo("teto")}`, numero("teto", 'step="500"'))}
        ${campo("pctAcima", "Acima do teto (% do CDI)", numero("pctAcima", `step="1" ${p.teto > 0 ? "" : "disabled"}`))}
        ${campo("carencia", p.vencimento ? `Meses até o vencimento ${termo("vencimento")}` : `Carência (meses) ${termo("carencia")}`, numero("carencia", 'step="1"'))}
        <label class="chave" for="${id("isento")}"><input type="checkbox" id="${id("isento")}" data-i="${i}" data-campo="isento" ${p.isento ? "checked" : ""} /> Isento de IR ${termo("isento")}</label>
      </div>
    </div>`;
  }).join("") || `<div class="vazio-estado">Nenhuma oferta cadastrada. Use "Adicionar produto" para cadastrar a primeira.</div>`;
  tecladoNumerico();
}

// Plano de renda fixa usado pela aba Renda fixa e pela aba Apps e corretoras.
function montarPlano({ inicial, mensal, meses, soLiquidez, mkt = mktRF() }) {
  const base = { inicial, mensal, meses, ...mkt, inflacao: num("ipca") / 100 };
  const todos = produtosValidos();
  const candidatos = todos.filter((p) => !soLiquidez || Calc.temLiquidezDiaria(p));
  const plano = candidatos.length ? Calc.simularPlano({ ...base, produtos: candidatos }) : null;
  const foraLiquidez = soLiquidez ? todos.filter((p) => !Calc.temLiquidezDiaria(p)) : [];
  if (!plano) return { plano, base, candidatos, foraLiquidez, foraPrazo: [] };
  const sozinhos = candidatos.map((p) => ({ p, r: Calc.simularPlano({ ...base, produtos: [p], distribuir: false }) })).filter((x) => x.r);
  const melhorSozinho = sozinhos.reduce((a, b) => (b.r.liquido > a.r.liquido ? b : a));
  return { plano, base, candidatos, melhorSozinho, foraLiquidez, foraPrazo: plano.foraPorCarencia };
}

function textoFora(r) {
  const nomes = (lista) => [...new Set(lista.map((p) => p.nome))].join(", ");
  const partes = [];
  if (r.foraLiquidez.length) partes.push(`sem resgate diário: ${nomes(r.foraLiquidez)}`);
  const prazo = r.foraPrazo.filter((p) => !r.foraLiquidez.includes(p));
  if (prazo.length) partes.push(`carência ou vencimento depois do prazo: ${nomes(prazo)}`);
  return partes.length ? ` Fora do plano (${partes.join("; ")}).` : "";
}

function htmlAlertaFGC(plano) {
  const grupos = Calc.concentracaoFGC(plano.porProduto.filter((x) => x.aportado > 0.5), Dados.FGC_LIMITE, Dados.TESOURO_EMISSOR).filter((g) => g.excede);
  if (!grupos.length) return "";
  return `<div class="alerta" role="note"><b>Atenção ao limite do FGC.</b> ${grupos.map((g) => `${esc(g.emissor)} termina com ${brl0(g.valor)}`).join("; ")}. O FGC garante até ${brl0(Dados.FGC_LIMITE)} por CPF em cada instituição: divida o valor entre emissores diferentes.</div>`;
}

function renderPlano() {
  const meses = Math.max(1, Math.min(600, Math.round(num("meses"))));
  const r = montarPlano({ inicial: num("inicial"), mensal: num("mensal"), meses, soLiquidez: $("rf-liquidez").checked });
  const { plano } = r;
  if (!plano) {
    $("plano-kpis").innerHTML = "";
    $("tab-plano").innerHTML = `<tbody><tr><td><div class="vazio-estado">Nenhum produto disponível para esse prazo. Cadastre um produto sem carência ou aumente o prazo.</div></td></tr></tbody>`;
    $("plano-nota").textContent = "";
    $("plano-fgc").innerHTML = "";
    return;
  }
  const ganho = plano.liquido - r.melhorSozinho.r.liquido;
  $("plano-nota").textContent = `Cada aporte vai para o produto com o melhor rendimento líquido no prazo de ${textoPrazo(meses)}. Quando um produto atinge o teto, o restante segue para o próximo.` + textoFora(r);
  $("plano-kpis").innerHTML = `
    <div class="kpi principal"><span class="kpi-rotulo">Líquido no fim</span><span class="kpi-valor">${brl0(plano.liquido)}</span><span class="kpi-sub">${brl0(plano.real)} em reais de hoje</span></div>
    <div class="kpi"><span class="kpi-rotulo">Lucro líquido</span><span class="kpi-valor ganho">${brl0(plano.lucroLiquido)}</span><span class="kpi-sub">sobre ${brl0(plano.investido)} investidos</span></div>
    <div class="kpi"><span class="kpi-rotulo">IR pago</span><span class="kpi-valor">${brl0(plano.ir)}</span><span class="kpi-sub">calculado aporte por aporte</span></div>
    <div class="kpi"><span class="kpi-rotulo">A mais que o melhor sozinho</span><span class="kpi-valor ${ganho > 0.5 ? "ganho" : ""}">${ganho > 0.5 ? "+" + brl0(ganho) : brl0(0)}</span><span class="kpi-sub">vs. tudo em ${esc(r.melhorSozinho.p.nome)}</span></div>`;
  const ativos = plano.porProduto.filter((x) => x.aportado > 0.5);
  $("tab-plano").innerHTML = `<thead><tr><th>Ordem</th><th>Aplicar</th><th>Bruto no fim</th><th>IR</th><th>Líquido</th></tr></thead><tbody>` +
    ativos.map((x, i) => `<tr>
      <td><span class="nome-classe"><span class="ponto" style="background:${corProduto(estado.produtosRF.indexOf(x.prod))}"></span><span>${i + 1}. ${esc(x.prod.nome)}<span class="sub">${esc(ondeComprar(x.prod))} · ${esc(descricaoProduto(x.prod))}</span></span></span></td>
      <td>${brl0(x.aportado)}${x.prod.teto > 0 && x.aportado >= x.prod.teto - 0.5 ? '<span class="etiqueta">teto</span>' : ""}</td>
      <td>${brl0(x.bruto)}</td><td>${x.ir > 0 ? "−" + brl0(x.ir) : brl0(0)}</td><td><b>${brl0(x.liquido)}</b></td>
    </tr>`).join("") + "</tbody>";
  $("plano-fgc").innerHTML = htmlAlertaFGC(plano);
}

function renderEquivalencia() {
  const mkt = mktRF();
  const prazos = [6, 12, 24, 36];
  const lista = produtosValidos();
  const vals = lista.map((p) => prazos.map((m) => (p.carencia > m ? null : Calc.equivalenteLiquido(p, m, mkt))));
  const melhores = prazos.map((_, j) => Math.max(...vals.map((v) => v[j] ?? -Infinity)));
  $("tab-equiv").innerHTML = `<thead><tr><th>Produto</th>${prazos.map((m) => `<th>${textoPrazo(m)}</th>`).join("")}</tr></thead><tbody>` +
    lista.map((p, i) => `<tr><td><span class="nome-classe"><span class="ponto" style="background:${corProduto(estado.produtosRF.indexOf(p))}"></span><span>${esc(p.nome)}<span class="sub">${esc(ondeComprar(p))} · ${esc(descricaoProduto(p))}${p.teto > 0 ? " · taxa válida até o teto" : ""}</span></span></span></td>` +
      vals[i].map((v, j) => v === null ? `<td class="fora">${p.vencimento ? "só no venc." : "carência"}</td>` : `<td class="${Math.abs(v - melhores[j]) < 1e-9 ? "vencedor" : ""}">${pct(v)}</td>`).join("") + "</tr>").join("") + "</tbody>";
}

function atualizarSimulador() {
  const meses = Math.max(1, Math.min(600, Math.round(num("meses"))));
  const base = { inicial: num("inicial"), mensal: num("mensal"), meses, ...mktRF(), inflacao: num("ipca") / 100 };
  renderPlano();
  renderEquivalencia();
  const res = produtosValidos()
    .map((p) => ({ p, cor: corProduto(estado.produtosRF.indexOf(p)), r: Calc.simularPlano({ ...base, produtos: [p], distribuir: false }) }))
    .filter((x) => x.r);
  $("prazo-txt").textContent = textoPrazo(meses);
  $("total-investido").textContent = brl(base.inicial + base.mensal * meses);
  if (!res.length) { $("tabela-res").innerHTML = ""; $("grafico").innerHTML = ""; $("legenda").innerHTML = ""; return; }
  const melhor = res.reduce((a, b) => (b.r.liquido > a.r.liquido ? b : a));
  $("tabela-res").innerHTML = res.map((x) => `<tr class="${x === melhor ? "melhor" : ""}">
      <td><span class="nome-classe"><span class="ponto" style="background:${x.cor}"></span>${esc(x.p.nome)}</span></td>
      <td>${brl0(x.r.bruto)}</td><td>${brl0(x.r.ir)}</td><td>${brl0(x.r.liquido)}</td><td>${brl0(x.r.lucroLiquido)}</td>
      <td class="${x.r.real < x.r.investido ? "perda" : ""}">${brl0(x.r.real)}</td></tr>`).join("");
  $("legenda").innerHTML = res.map((x) => `<span><i class="traco" style="background:${x.cor}"></i>${esc(x.p.nome)}</span>`).join("") +
    `<span><i class="traco" style="background:${css("--tinta-3")};opacity:.6"></i>Valor investido</span>`;
  const ev = res[0].r.evolucao;
  Charts.linhas($("grafico"), {
    altura: 260, x: ev.map((e) => e.mes), xTicks: 5, yFmt: brlC, rotulo: "Evolução do saldo bruto",
    xFmt: (m) => (m === 0 ? "hoje" : m + " m"), xTooltip: (m) => (m === 0 ? "Hoje" : `Mês ${m}`),
    series: [
      { nome: "Investido", cor: css("--tinta-3"), valores: ev.map((e) => e.investido), tracejado: true, largura: 1.5 },
      ...res.map((x) => ({ nome: x.p.nome, cor: x.cor, valores: x.r.evolucao.map((e) => e.saldo) })),
    ],
    linhasTooltip: (i) => [...res.map((x) => ({ cor: x.cor, nome: x.p.nome, valor: brl(x.r.evolucao[i].saldo) })), { cor: css("--tinta-3"), nome: "Investido", valor: brl(ev[i].investido) }],
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

RENDER["renda-fixa"] = () => { renderProdutos(); atualizarSimulador(); atualizarReserva(); atualizarMeta(); };

async function carregarTaxas() {
  const status = $("status-taxas");
  status.className = "status";
  status.textContent = "Buscando taxas no Banco Central…";
  let r = {};
  try { r = await Live.bancoCentral(); } catch { r = {}; }
  estado.bcb = r;
  const ok = ["selic", "cdi", "ipca"].filter((k) => r[k]);
  ok.forEach((k) => ($(k).value = r[k].valor.toFixed(2)));
  if (r.dolar) $("ap-dolar").value = r.dolar.valor.toFixed(2);
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

// ============ APPS E CORRETORAS ============
const OBJETIVOS = [
  { id: "reserva", nome: "Reserva de emergência" },
  { id: "longo", nome: "Dinheiro parado 1 ano ou mais" },
  { id: "acoes", nome: "Ações, ETFs e FIIs" },
  { id: "exterior", nome: "Exterior (dólar)" },
  { id: "cripto", nome: "Cripto" },
];
const ROTULO_CUSTO = {
  corretagem: ["Corretagem (R$ por ordem)", "0.5", "corretagem"],
  custodia: ["Custódia de ações (% a.a.)", "0.01", "custodia"],
  cripto: ["Cripto (% por operação)", "0.05", "spread"],
  cambio: ["Câmbio (spread %)", "0.1", "spread"],
};
const CUSTOS_POR_OFERTA = { acoes: ["corretagem", "custodia"], cripto: ["cripto"], exterior: ["cambio"] };
const SITE_GITHUB = "https://alaneto2007-star.github.io/Teste-App-para-investimento-/";
let filtroApps = "todos";
let apCdiEditado = false; // o usuário mudou o CDI médio do período? Se não, ele acompanha o CDI atual.
const custosApp = (id) => ({ ...plataforma(id).custos, ...(estado.plataformas[id] || {}) });
const oferecem = (oferta) => PLATAFORMAS.filter((p) => p.oferece.includes(oferta));
const usd = (v) => "US$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function renderObjetivos() {
  $("ap-objetivos").innerHTML = OBJETIVOS.map((o) => `<button type="button" class="filtro objetivo" data-obj="${o.id}" aria-pressed="${o.id === estado.objetivo}">${o.nome}</button>`).join("");
  $("form-apps").querySelectorAll("[data-ap]").forEach((el) => (el.hidden = !el.dataset.ap.split(" ").includes(estado.objetivo)));
}

// Nome do melhor app e, se houver, dos que empatam com ele (diferença menor que R$ 1).
function tituloComEmpate(lista, valor, extra = "") {
  const empatados = lista.filter((x) => Math.abs(valor(x) - valor(lista[0])) < 1);
  const resto = empatados.slice(1).map((x) => esc(x.p.nome));
  return `${esc(lista[0].p.nome)}${resto.length ? `<span class="onde">empatado com ${resto.join(", ")}</span>` : extra}`;
}

const cabecalhoMelhor = (titulo, texto) =>
  `<p class="sobre">Melhor escolha agora</p><h2 class="melhor-titulo">${titulo}</h2>${texto ? `<p class="nota">${texto}</p>` : ""}`;

// No longo prazo o CDI não fica parado. O prefixado do Tesouro com vencimento mais próximo do prazo
// mostra o CDI médio que o mercado espera até lá (sem descontar o prêmio de risco).
function tituloMaisProximo(tipo, meses) {
  const lista = (estado.tesouro?.titulos || []).filter((t) => t.tipo === tipo);
  if (!lista.length) return null;
  return lista.reduce((a, b) => (Math.abs(mesesAte(b.vencimento) - meses) < Math.abs(mesesAte(a.vencimento) - meses) ? b : a));
}
const prefixadoReferencia = (meses) => tituloMaisProximo("prefixado", meses);

function mercadoDoObjetivo(reserva, meses) {
  const atual = mktRF();
  if (!apCdiEditado) $("ap-cdi").value = (atual.cdi * 100).toFixed(2);
  const ref = prefixadoReferencia(meses);
  $("ap-cdi-nota").textContent = ref
    ? `O ${ref.nome} paga ${pct(ref.taxa, 2)} ao ano: é, na prática, o CDI médio que o mercado espera até ${ref.vencimento.slice(-4)}. Hoje o CDI está em ${pct(atual.cdi * 100, 2)}.`
    : "Supõe o CDI de hoje durante todo o prazo. Se os juros caírem, prefixados e IPCA+ ficam mais vantajosos: ajuste este valor.";
  if (reserva) return atual;
  const cdi = num("ap-cdi") / 100;
  return { ...atual, cdi, selic: Math.max(0, cdi + (atual.selic - atual.cdi)) };
}

function renderMelhorRendaFixa() {
  const reserva = estado.objetivo === "reserva";
  const meses = reserva ? 12 : +$("ap-prazo").value;
  const mktPlano = mercadoDoObjetivo(reserva, meses);
  const r = montarPlano({ inicial: num("ap-valor"), mensal: num("ap-mensal"), meses, soLiquidez: reserva, mkt: mktPlano });
  if (!r.plano) {
    $("ap-melhor").innerHTML = cabecalhoMelhor("Nenhuma oferta disponível", "") +
      `<div class="vazio-estado">Cadastre as ofertas que você vê nos seus apps na aba <a href="#renda-fixa">Renda fixa</a>${reserva ? ", com resgate a qualquer dia" : ""}.</div>`;
    $("ap-detalhe").innerHTML = "";
    return;
  }
  const eq = (p) => Calc.equivalenteLiquido(p, meses, mktPlano);
  const passos = r.plano.porProduto.filter((x) => x.aportado > 0.5);
  const primeiro = passos[0];
  const poupanca = Calc.simularPlano({ ...r.base, distribuir: false, produtos: [{ id: "ref", nome: "Poupança", tipo: "poupanca", pct: 100, isento: true, teto: 0, pctAcima: 100, carencia: 0 }] });
  const ganhoPoupanca = r.plano.liquido - poupanca.liquido;
  $("ap-melhor").innerHTML =
    cabecalhoMelhor(`${esc(primeiro.prod.nome)}<span class="onde">${esc(ondeComprar(primeiro.prod))}</span>`,
      `Rende ${pct(eq(primeiro.prod))} do CDI depois do IR em ${textoPrazo(meses)}${primeiro.prod.teto > 0 ? `, até ${brl0(primeiro.prod.teto)}` : ""}.`) +
    `<ol class="passos">${passos.map((x) => `<li><span class="passo-valor">${brl0(x.aportado)}</span><span><b>${esc(x.prod.nome)}</b><span class="sub">${esc(ondeComprar(x.prod))} · rende ${pct(eq(x.prod))} do CDI líquido${x.prod.teto > 0 && x.aportado >= x.prod.teto - 0.5 ? " · no limite do teto" : ""}</span></span></li>`).join("")}</ol>
    <div class="kpis">
      <div class="kpi"><span class="kpi-rotulo">Líquido em ${textoPrazo(meses)}</span><span class="kpi-valor">${brl0(r.plano.liquido)}</span><span class="kpi-sub">${brl0(r.plano.investido)} investidos</span></div>
      <div class="kpi"><span class="kpi-rotulo">A mais que a poupança</span><span class="kpi-valor ${ganhoPoupanca > 0.5 ? "ganho" : ""}">${ganhoPoupanca > 0.5 ? "+" + brl0(ganhoPoupanca) : brl0(0)}</span><span class="kpi-sub">no mesmo período</span></div>
    </div>` + htmlAlertaFGC(r.plano) +
    `<p class="nota">${reserva ? "Só entram produtos com resgate a qualquer dia. IR calculado para 1 ano." : "Prefixados e IPCA+ só garantem a taxa até o vencimento: entram no plano quando o prazo chega ao vencimento."}${textoFora(r)}</p>`;
  const lista = r.candidatos.filter((p) => (p.carencia || 0) <= meses).map((p) => ({ p, v: eq(p) })).sort((a, b) => b.v - a.v);
  $("ap-detalhe").innerHTML = `<div class="painel-cabeca"><div><h2>Todas as opções para este objetivo</h2><p class="nota">Rendimento depois do IR em ${textoPrazo(meses)}, em % do CDI. Ofertas com teto valem só até o limite.</p></div><a class="link-acao" href="#renda-fixa">Cadastrar ofertas →</a></div>
    <div class="rolagem"><table class="tabela"><thead><tr><th>Produto</th><th>Onde</th><th>Rende</th><th>Teto</th></tr></thead><tbody>` +
    lista.map((x, i) => `<tr class="${i === 0 ? "melhor" : ""}"><td><span class="nome-classe"><span class="ponto" style="background:${corProduto(estado.produtosRF.indexOf(x.p))}"></span><span>${esc(x.p.nome)}<span class="sub">${esc(descricaoProduto(x.p))}</span></span></span></td><td class="texto">${esc(ondeComprar(x.p))}</td><td>${pct(x.v)}</td><td>${x.p.teto > 0 ? brl0(x.p.teto) : "—"}</td></tr>`).join("") +
    "</tbody></table></div>";
}

function renderMelhorAcoes() {
  const valorOrdem = num("ap-ordem"), ordensMes = num("ap-ordens"), saldo = num("ap-saldo");
  const lista = oferecem("acoes").map((p) => {
    const c = custosApp(p.id);
    return { p, c, r: Calc.custoAcoes({ valorOrdem, ordensMes, saldo, corretagem: c.corretagem ?? 0, custodiaPct: c.custodia ?? 0, taxaB3Pct: Dados.TAXA_B3 }) };
  }).sort((a, b) => a.r.total - b.r.total);
  const melhor = lista[0], pior = lista.at(-1);
  const empatados = lista.filter((x) => x.r.total - melhor.r.total < 1);
  $("ap-melhor").innerHTML = (empatados.length === lista.length
    ? cabecalhoMelhor("Custo igual nos principais apps", `Com corretagem zero, você paga só as taxas da B3: ${brl(melhor.r.total)} por ano (${pct(melhor.r.pctAportes, 2)} do que investe). Escolha o app que você já usa e acha mais fácil.`)
    : cabecalhoMelhor(tituloComEmpate(lista, (x) => x.r.total),
      `Custo de ${brl(melhor.r.total)} por ano, ${brl(pior.r.total - melhor.r.total)} a menos que ${esc(pior.p.nome)}.`)) +
    `<div class="rolagem"><table class="tabela"><thead><tr><th>App</th><th>Corretagem</th><th>Custódia</th><th>Custo por ano</th></tr></thead><tbody>` +
    lista.map((x) => `<tr><td>${esc(x.p.nome)}</td><td>${brl(x.c.corretagem ?? 0)}</td><td>${pct(x.c.custodia ?? 0, 2)}</td><td>${brl(x.r.total)}</td></tr>`).join("") +
    `</tbody></table></div><p class="nota">As taxas da B3 (cerca de ${pct(Dados.TAXA_B3, 2)} por operação) são iguais em todos os apps. Corretagem e custódia são valores de referência: confira no app e corrija no catálogo abaixo.</p>`;
  $("ap-detalhe").innerHTML = `<h2>Por onde começar na bolsa</h2>
    <p class="nota">O hub não indica ação específica: isso depende de análise individual e é atividade regulada pela CVM. Um caminho simples para começar são os ETFs, que compram dezenas de empresas de uma vez.</p>
    <div class="etfs">${Dados.ETFS_INICIO.map((e) => `<div class="etf"><b>${e.ticker}</b><span>${esc(e.indice)}</span><span class="sub">Taxa de administração ≈ ${pct(e.taxa, 2)} ao ano</span></div>`).join("")}</div>
    <p class="nota">Não é recomendação. Taxas aproximadas: confira no site da gestora. A venda de ETF paga 15% de IR sobre o lucro, sem a isenção de R$ 20 mil por mês que vale para ações.</p>`;
}

function renderMelhorExterior() {
  const valor = num("ap-valor"), iof = num("ap-iof"), dolar = num("ap-dolar");
  const vivo = estado.bcb?.dolar;
  $("ap-dolar-nota").textContent = vivo ? `Dólar do Banco Central de ${vivo.data}.` : "Cotação de exemplo: edite com a do dia.";
  const lista = oferecem("exterior").map((p) => ({ p, c: custosApp(p.id) })).filter((x) => x.c.cambio != null)
    .map((x) => ({ ...x, r: Calc.custoExterior({ valor, spreadPct: x.c.cambio, iofPct: iof, dolar }) }))
    .sort((a, b) => b.r.chega - a.r.chega);
  const m = lista[0];
  const chega = (r) => (dolar ? usd(r.emDolar) : brl(r.chega));
  $("ap-melhor").innerHTML = cabecalhoMelhor(tituloComEmpate(lista, (x) => x.r.chega), `Enviando ${brl0(valor)}, chegam ${chega(m.r)} na conta depois do IOF e do spread de câmbio (custo de ${brl(m.r.custo)}).`) +
    `<div class="rolagem"><table class="tabela"><thead><tr><th>App</th><th>Spread</th><th>Custo</th><th>Chega</th></tr></thead><tbody>` +
    lista.map((x) => `<tr><td>${esc(x.p.nome)}</td><td>${pct(x.c.cambio, 2)}</td><td>${brl(x.r.custo)}</td><td>${chega(x.r)}</td></tr>`).join("") +
    `</tbody></table></div><p class="nota">Spread de referência: o custo exato aparece na tela de envio do app. Rendimentos no exterior pagam 15% de IR ao ano (Lei 14.754/2023) e precisam ser declarados.</p>`;
  $("ap-detalhe").innerHTML = `<h2>Sem enviar dinheiro para fora</h2>
    <p class="nota">ETFs na B3, como IVVB11 (S&amp;P 500) e WRLD11 (ações do mundo todo), dão exposição ao exterior e ao dólar pela corretora brasileira, sem câmbio nem IOF. A taxa de administração fica embutida no preço e a venda paga 15% de IR sobre o lucro.</p>`;
}

function renderMelhorCripto() {
  const valor = num("ap-valor");
  const lista = oferecem("cripto").map((p) => ({ p, c: custosApp(p.id) })).filter((x) => x.c.cripto != null)
    .map((x) => ({ ...x, r: Calc.custoCripto({ valor, taxaPct: x.c.cripto }) }))
    .sort((a, b) => a.r.custo - b.r.custo);
  const m = lista[0];
  $("ap-melhor").innerHTML = cabecalhoMelhor(tituloComEmpate(lista, (x) => x.r.custo, `<span class="onde">${Dados.TIPOS_PLATAFORMA[m.p.tipo]}</span>`),
    `Comprar e depois vender ${brl0(valor)} custa cerca de ${brl(m.r.custo)} (${pct(m.r.pct, 2)}), contra ${brl(lista.at(-1).r.custo)} no app mais caro.`) +
    `<div class="rolagem"><table class="tabela"><thead><tr><th>App</th><th>Tipo</th><th>Por operação</th><th>Comprar e vender</th></tr></thead><tbody>` +
    lista.map((x) => `<tr><td>${esc(x.p.nome)}</td><td class="texto">${Dados.TIPOS_PLATAFORMA[x.p.tipo]}</td><td>${pct(x.c.cripto, 2)}</td><td>${brl(x.r.custo)}</td></tr>`).join("") +
    `</tbody></table></div><p class="nota">Taxas e spreads de referência: confira no app. Em apps de banco, o custo costuma vir embutido no preço.</p>`;
  $("ap-detalhe").innerHTML = `<h2>Exchange, app do banco ou ETF?</h2>
    <ul class="lista-texto">
      <li><b>Exchange</b> (Binance, Mercado Bitcoin, Foxbit): custo menor e você pode levar as moedas para a sua própria carteira. Vendas de até R$ 35 mil por mês são isentas de IR.</li>
      <li><b>App do banco ou corretora</b>: mais simples, tudo no mesmo lugar, mas o custo embutido costuma ser maior.</li>
      <li><b>ETFs na B3</b> (QBTC11, BITH11, HASH11): compra pela corretora, como uma ação. Têm taxa de administração anual e pagam 15% de IR sobre o lucro, sem isenção.</li>
    </ul>`;
}

function renderMelhor() {
  const fn = { reserva: renderMelhorRendaFixa, longo: renderMelhorRendaFixa, acoes: renderMelhorAcoes, exterior: renderMelhorExterior, cripto: renderMelhorCripto }[estado.objetivo] || renderMelhorRendaFixa;
  fn();
}

// ---- Tesouro Direto (taxas oficiais em data/tesouro.json, gravadas pelo robô do GitHub)
function taxaTesouroTexto(t) {
  if (/selic/i.test(t.tipoTitulo)) return `Selic + ${t.taxa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
  if (/prefixado/i.test(t.tipoTitulo)) return `${pct(t.taxa, 2)} ao ano`;
  if (/igp/i.test(t.tipoTitulo)) return `IGP-M + ${pct(t.taxa, 2)}`;
  return `IPCA + ${pct(t.taxa, 2)}`;
}
const idTesouro = (t) => "td-" + t.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function mesesAte(dataBR) {
  const [d, m, a] = dataBR.split("/").map(Number);
  return Math.max(1, Math.round((new Date(a, m - 1, d) - new Date()) / (1000 * 60 * 60 * 24 * 30.44)));
}
// Converte um título em oferta. Selic: liquidez diária e isenção de custódia até R$ 10 mil.
// Prefixado e IPCA+: a taxa só é garantida no vencimento, que entra como "carência".
function produtoDoTesouro(t) {
  const selic = t.tipo === "selic";
  return {
    id: idTesouro(t), nome: t.nome, tipo: t.tipo, pct: selic ? 100 : t.taxa, isento: false, teto: 0, pctAcima: 100,
    carencia: selic ? 0 : mesesAte(t.vencimento), plataforma: "", emissor: Dados.TESOURO_EMISSOR, custodia: selic ? 0 : 0.2, vencimento: t.vencimento,
  };
}

function renderTesouro() {
  const d = estado.tesouro;
  const cab = `<div class="painel-cabeca"><div><h2>Tesouro Direto hoje</h2><p class="nota">${d ? `Taxas oficiais de ${esc(d.dataBase)}, iguais em qualquer corretora. Fonte: Tesouro Transparente.` : "Taxas oficiais, atualizadas todo dia útil por um robô do GitHub."}</p></div></div>`;
  if (!d) {
    $("ap-tesouro").innerHTML = cab + `<div class="vazio-estado">As taxas do Tesouro carregam no <a href="${SITE_GITHUB}#apps" target="_blank" rel="noopener">site do GitHub</a>. Aqui elas não estão disponíveis; se quiser, cadastre os títulos à mão na aba Renda fixa.</div>`;
    return;
  }
  const linha = ({ t, i }) => {
    const ja = estado.produtosRF.some((p) => p.id === idTesouro(t));
    const acao = t.tipo
      ? `<button type="button" class="botao fantasma pequeno" data-tesouro="${i}" ${ja ? "disabled" : ""}>${ja ? "Nas ofertas ✓" : "Adicionar às ofertas"}</button>`
      : `<span class="sub">Só consulta</span>`;
    return `<tr><td>${esc(t.nome)}</td><td>${esc(t.vencimento)}</td><td>${esc(taxaTesouroTexto(t))}</td><td>${brl(t.pu)}</td><td>${acao}</td></tr>`;
  };
  const tabela = (lista) => `<div class="rolagem"><table class="tabela"><thead><tr><th>Título</th><th>Vence em</th><th>Taxa</th><th>Preço de 1 título</th><th></th></tr></thead><tbody>${lista.map(linha).join("")}</tbody></table></div>`;
  const todos = d.titulos.map((t, i) => ({ t, i }));
  const principais = todos.filter((x) => x.t.tipo);
  const outros = todos.filter((x) => !x.t.tipo);
  $("ap-tesouro").innerHTML = cab +
    `<div class="curvas">
      <figure class="curva"><figcaption>Prefixado <span class="sub">taxa ao ano</span></figcaption><div class="grafico" id="g-curva-pre"></div></figure>
      <figure class="curva"><figcaption>IPCA+ <span class="sub">juro acima da inflação</span></figcaption><div class="grafico" id="g-curva-ipca"></div></figure>
    </div>
    <p class="nota">Cada ponto é um título e a linha é a "curva de juros": quanto o governo paga para cada prazo. Passe o mouse ou toque nos pontos.</p>` +
    tabela(principais) +
    `<p class="nota">Ao adicionar, o título entra nas ofertas com a custódia da B3 de 0,20% ao ano (o Tesouro Selic é isento até R$ 10 mil). Prefixado e IPCA+ só garantem a taxa se você ficar até o vencimento ${termo("marcacao")}.</p>` +
    (outros.length ? `<details class="outros-titulos"><summary>Outros títulos (${outros.length}): Educa+, Renda+ e com juros semestrais</summary>
      <ul class="lista-texto">
        <li><b>Tesouro Educa+</b>: junta dinheiro para a educação e devolve em 60 parcelas mensais a partir do ano escolhido.</li>
        <li><b>Tesouro Renda+</b>: monta uma aposentadoria complementar, paga em 240 parcelas mensais.</li>
        <li><b>Com juros semestrais</b>: pagam parte dos juros a cada 6 meses, com IR em cada pagamento.</li>
      </ul>
      <p class="nota">O simulador ainda não calcula esses pagamentos, por isso esses títulos aparecem só para consulta.</p>${tabela(outros)}</details>` : "");
  desenharCurvas(d);
}

function desenharCurvas(d) {
  const curva = (tipo, el, cor, yRotulo) => {
    const pontos = d.titulos.filter((t) => t.tipo === tipo).map((t) => ({
      x: Math.max(0.05, mesesAte(t.vencimento) / 12), y: t.taxa, rotulo: t.vencimento.slice(-4), cor, grupo: "curva", nomeTooltip: t.nome,
    }));
    if (pontos.length < 2) { $(el).innerHTML = ""; return; }
    Charts.dispersao($(el), pontos, {
      altura: 220, ligar: "curva", rotulo: `Curva de juros: ${yRotulo}`,
      xFmt: (v) => v + (v === 1 ? " ano" : " anos"), yFmt: (v) => pct(v, 1), xRotulo: "Anos até o vencimento", yRotulo,
    });
  };
  curva("prefixado", "g-curva-pre", css("--acento"), "% ao ano");
  curva("ipca", "g-curva-ipca", css("--ocre"), "IPCA + % ao ano");
}

function renderCatalogoApps() {
  const tipos = [["todos", "Todos"], ...Object.entries(Dados.TIPOS_PLATAFORMA)];
  $("ap-filtro").innerHTML = tipos.map(([id, nome]) => `<button type="button" class="filtro" data-fa="${id}" aria-pressed="${id === filtroApps}">${nome}</button>`).join("");
  $("ap-catalogo").innerHTML = PLATAFORMAS.filter((p) => filtroApps === "todos" || p.tipo === filtroApps).map((p) => {
    const c = custosApp(p.id);
    const campos = Object.entries(CUSTOS_POR_OFERTA).filter(([o]) => p.oferece.includes(o)).flatMap(([, cs]) => cs);
    return `<article class="painel app-cartao">
      <div class="inst-topo"><h3>${esc(p.nome)}</h3><span class="selo">${Dados.TIPOS_PLATAFORMA[p.tipo]}</span></div>
      <p class="nota">${esc(p.destaque)}</p>
      <ul class="chips" aria-label="O que oferece">${p.oferece.map((o) => `<li>${Dados.OFERTAS[o]}</li>`).join("")}</ul>
      ${campos.length ? `<div class="app-custos">${campos.map((k) => `<label for="apc-${p.id}-${k}">${ROTULO_CUSTO[k][0]} ${termo(ROTULO_CUSTO[k][2])}<input type="number" id="apc-${p.id}-${k}" data-app="${p.id}" data-custo="${k}" step="${ROTULO_CUSTO[k][1]}" min="0" value="${c[k] ?? ""}" /></label>`).join("")}</div>` : ""}
      <p class="cuidado"><b>Cuidado:</b> ${esc(p.cuidado)}</p>
      <p class="ref">${estado.plataformas[p.id] ? "Custos editados por você" : "Custos de referência (2025): confira no app"}</p>
    </article>`;
  }).join("");
  tecladoNumerico();
}

RENDER.apps = () => { renderObjetivos(); renderMelhor(); renderTesouro(); renderCatalogoApps(); };

async function carregarTesouro() {
  estado.tesouro = await Live.tesouro();
  if (estado.tesouro) {
    // Mantém atualizadas as taxas dos títulos que já estão nas ofertas.
    let mudou = false;
    estado.tesouro.titulos.filter((t) => t.tipo).forEach((t) => {
      const p = estado.produtosRF.find((x) => x.id === idTesouro(t));
      if (p) { Object.assign(p, produtoDoTesouro(t), { nome: p.nome, plataforma: p.plataforma }); mudou = true; }
    });
    if (mudou) gravar();
  }
  renderFita();
  if (rotaAtual === "apps") { renderTesouro(); renderMelhor(); }
  else if (rotaAtual && rotaAtual !== "visao") RENDER[rotaAtual]?.();
}

// ============ MANUAL ============
const nomeAba = (rota) => Dados.GUIA_ABAS.find((a) => a.rota === rota)?.nome || rota;

// Exemplo de cada investimento com R$ 1.000. Renda fixa usa as taxas atuais; renda variável é hipotética.
function exemploManual(inv) {
  const e = inv.exemplo;
  const mkt = mktRF();
  const umAno = (prod) => Calc.simularPlano({ produtos: [{ id: "ex", nome: inv.nome, teto: 0, pctAcima: 100, carencia: 0, isento: false, ...prod }], inicial: 1000, mensal: 0, meses: 12, ...mkt, distribuir: false });
  if (e.tipo === "rf") {
    const r = umAno(e.prod);
    return `${e.hipotetico ? "Exemplo hipotético com IPCA + 7,5% isento: " : ""}R$ 1.000 viram ${brl(r.liquido)} em 1 ano${e.prod.isento ? " (sem IR)" : ", já descontado o IR"}.`;
  }
  if (e.tipo === "tesouro") {
    const t = tituloMaisProximo(e.familia, e.prazoRef);
    const r = umAno({ tipo: e.familia, pct: t ? t.taxa : e.padrao, custodia: 0.2 });
    const taxa = t ? `${t.nome}, ${taxaTesouroTexto(t)}` : `taxa de exemplo de ${e.familia === "ipca" ? "IPCA + " : ""}${pct(e.padrao, 0)}`;
    return `Com o ${taxa}: R$ 1.000 viram cerca de ${brl(r.liquido)} em 1 ano, já descontados IR e custódia. Isso vale para quem fica até o vencimento; vendendo antes, o valor muda.`;
  }
  if (e.tipo === "fii") {
    const fii = num("m-fii");
    return `Com rendimento de ${pct(fii, 1)} ao ano, R$ 1.000 pagam cerca de ${brl((1000 * fii) / 100 / 12)} por mês, sem IR. O valor da cota pode subir ou cair.`;
  }
  if (e.tipo === "acoes") {
    const dy = num("m-acoes");
    return `Exemplo hipotético: com dividendos de ${pct(dy, 1)} ao ano, R$ 1.000 pagam ${brl((1000 * dy) / 100)} por ano. Se a ação subir 10%, você ganha mais ${brl(100)} ao vender; se cair 30%, perde ${brl(300)}.`;
  }
  if (e.tipo === "etf") return `Exemplo hipotético: se o Ibovespa subir 10% em um ano, R$ 1.000 em BOVA11 viram cerca de ${brl(1000 * 1.1 * (1 - 0.001))} (taxa de 0,10% ao ano). Se cair 10%, viram cerca de ${brl(1000 * 0.9 * (1 - 0.001))}.`;
  if (e.tipo === "exterior") return `Exemplo hipotético: se as ações sobem 8% e o dólar sobe 5%, R$ 1.000 viram cerca de ${brl(1000 * 1.08 * 1.05)}. Se o dólar cair 10%, o mesmo investimento vira cerca de ${brl(1000 * 1.08 * 0.9)}.`;
  if (e.tipo === "historico") {
    const c = classe(e.classe);
    const est = Calc.estatisticas(c.hist);
    return `Não paga renda: R$ 1.000 só viram mais se o preço subir. De 2016 a 2024, o melhor ano em reais foi ${pct(est.melhor * 100, 0, true)} e o pior, ${pct(est.pior * 100, 0, true)}.`;
  }
  if (e.tipo === "fundo") return `Com retorno bruto de 12% ao ano, uma taxa de administração de 2% deixa R$ 1.000 em ${brl(1000 * Math.pow(1.1, 10))} depois de 10 anos, contra ${brl(1000 * Math.pow(1.12, 10))} sem a taxa.`;
  return "";
}

// Renda mensal estimada de um valor em cada investimento, com as taxas de hoje.
function linhasRenda(valor) {
  const mkt = mktRF();
  const rf = (taxaAnual, ir) => Calc.rendaMensal({ valor, taxaAnual, ir });
  const comCustodia = (r) => (1 + r) * 0.998 - 1;
  const linhas = [
    { nome: "Poupança", como: "Juros todo mês, no aniversário do depósito", mes: rf(Calc.taxaPoupanca(mkt.selic), 0), imposto: "Isenta" },
    { nome: "Tesouro Selic", como: "Juros que se acumulam e você recebe na venda", mes: rf(mkt.selic, 0.15), imposto: "15% (mais de 2 anos)" },
    { nome: "CDB 100% do CDI", como: "Juros que se acumulam e você recebe no resgate", mes: rf(mkt.cdi, 0.15), imposto: "15% (mais de 2 anos)" },
    { nome: "LCI/LCA 90% do CDI", como: "Juros que se acumulam até o vencimento", mes: rf(Calc.taxaPctCDI(mkt.cdi, 90), 0), imposto: "Isenta" },
  ];
  const pre = tituloMaisProximo("prefixado", 36);
  linhas.push({ nome: pre ? pre.nome : "Tesouro Prefixado (exemplo: 13%)", como: "Juros travados na compra, recebidos no vencimento", mes: rf(comCustodia((pre ? pre.taxa : 13) / 100), 0.15), imposto: "15% (mais de 2 anos)" });
  const ip = tituloMaisProximo("ipca", 120);
  linhas.push({ nome: ip ? ip.nome : "Tesouro IPCA+ (exemplo: IPCA + 7%)", como: "Inflação + juro fixo, recebidos no vencimento", mes: rf(comCustodia((1 + mkt.ipca) * (1 + (ip ? ip.taxa : 7) / 100) - 1), 0.15), imposto: "15% (mais de 2 anos)" });
  // Melhor oferta cadastrada pelo usuário (respeitando o teto).
  const ofertas = produtosValidos().map((p) => {
    const r1 = Calc.taxaProduto(p, mkt), r2 = Calc.taxaProduto(p, mkt, true), ir = p.isento ? 0 : 0.15;
    const dentro = p.teto > 0 ? Math.min(valor, p.teto) : valor;
    return { p, mes: Calc.rendaMensal({ valor: dentro, taxaAnual: r1, ir }) + Calc.rendaMensal({ valor: valor - dentro, taxaAnual: r2, ir }) };
  }).sort((a, b) => b.mes - a.mes);
  if (ofertas.length) {
    const o = ofertas[0];
    linhas.push({ nome: `Sua melhor oferta: ${o.p.nome}`, como: `${ondeComprar(o.p)} · ${descricaoProduto(o.p)}`, mes: o.mes, imposto: o.p.isento ? "Isenta" : "15% (mais de 2 anos)", destaque: true });
  }
  linhas.push(
    { nome: "Fundos imobiliários", como: "Aluguéis depositados todo mês", mes: (valor * num("m-fii")) / 100 / 12, imposto: "Isentos (com condições)" },
    { nome: "Ações (dividendos)", como: "Parte do lucro, algumas vezes por ano (média mensal)", mes: (valor * num("m-acoes")) / 100 / 12, imposto: "Isentos para a maioria" },
    { nome: "Bitcoin e ouro", como: "Não pagam renda: só ganham se o preço subir", mes: 0, imposto: "Na venda com lucro" },
  );
  return linhas;
}

function renderRendaMensal() {
  const valor = num("m-valor");
  const linhas = linhasRenda(valor);
  const max = Math.max(...linhas.map((l) => l.mes), 1);
  const m = mktRF();
  $("tab-renda").innerHTML = `<thead><tr><th>Investimento</th><th>Como o dinheiro chega</th><th>Por mês</th><th>Em 12 meses</th><th>Imposto</th></tr></thead><tbody>` +
    linhas.map((l) => `<tr${l.destaque ? ' class="linha-destaque"' : ""}>
      <td>${esc(l.nome)}</td>
      <td class="texto">${esc(l.como)}</td>
      <td><span class="valor-barra" style="--p:${((l.mes / max) * 100).toFixed(1)}%">${brl(l.mes)}</span></td>
      <td>${brl(l.mes * 12)}</td>
      <td class="texto">${esc(l.imposto)}</td>
    </tr>`).join("") + "</tbody>";
  $("renda-nota").textContent = `Estimativas com as taxas de hoje (Selic ${pct(m.selic * 100, 2)}, CDI ${pct(m.cdi * 100, 2)}, IPCA ${pct(m.ipca * 100, 2)}) e IR de 15%, que vale para aplicações de mais de 2 anos. ` +
    "Na renda fixa, os juros se acumulam e você recebe no resgate: o valor por mês é uma média. FIIs e ações: estimativas médias; cada fundo e cada empresa paga diferente, e a cota ou a ação pode cair.";
}

// Parte 3 do manual: um cartão por investimento, agrupado pelo mecanismo de retorno.
function renderInvestimentosManual() {
  const M = Dados.MANUAL_MECANISMOS;
  $("m-investimentos").innerHTML = `<article class="painel"><h2>Cada investimento, explicado</h2><p class="nota">Agrupados pela forma como o dinheiro volta para você. Os exemplos de renda fixa usam as taxas de hoje; os de renda variável são hipotéticos.</p></article>` +
    M.map((m) => {
      const lista = Dados.MANUAL_INVESTIMENTOS.filter((i) => i.mecanismo === m.id);
      return `<article class="painel"><p class="sobre">${esc(m.nome)}</p><h2>${esc(m.titulo)}</h2>
        <div class="investimentos">${lista.map((inv) => `
          <div class="inv-cartao" id="inv-${inv.id}">
            <h3>${esc(inv.nome)}</h3>
            <p class="inv-frase">${esc(inv.frase)}</p>
            <dl class="inv-dl">
              <dt>Como o dinheiro volta</dt><dd>${esc(inv.comoGanha)}</dd>
              <dt>Quando você recebe</dt><dd>${esc(inv.quando)}</dd>
              <dt>Exemplo com R$ 1.000</dt><dd class="exemplo">${esc(exemploManual(inv))}</dd>
              <dt>Riscos</dt><dd>${esc(inv.riscos)}</dd>
              <dt>Imposto</dt><dd>${esc(inv.imposto)}</dd>
            </dl>
            <a class="link-acao" href="#${inv.rota}">Ver em ${esc(nomeAba(inv.rota))} →</a>
          </div>`).join("")}</div></article>`;
    }).join("");
}

function renderManual() {
  const M = Dados.MANUAL_MECANISMOS;
  // 1. Mecanismos e juros compostos
  const prazos = [[1, "1 mês"], [12, "1 ano"], [60, "5 anos"], [120, "10 anos"], [240, "20 anos"]];
  const simples = (m) => 1000 * (1 + 0.01 * m), composto = (m) => 1000 * Math.pow(1.01, m);
  $("m-mecanismos").innerHTML = `
    <h2>Como o dinheiro volta para você</h2>
    <p class="nota">Todo investimento devolve dinheiro de um destes quatro jeitos. Alguns combinam mais de um: uma ação paga dividendos e também pode se valorizar.</p>
    <div class="mecanismos">${M.map((m) => `<div class="mecanismo"><span class="mec-nome">${esc(m.nome)}</span><h3>${esc(m.titulo)}</h3><p>${esc(m.texto)}</p><p class="sub">Exemplos: ${esc(m.exemplos)}</p></div>`).join("")}</div>
    <h3 class="m-sub">O segredo: juros compostos ${termo("jurosCompostos")}</h3>
    <p class="m-texto">Quando os juros de um mês passam a render nos meses seguintes, o dinheiro cresce cada vez mais rápido. Veja R$ 1.000 rendendo 1% ao mês:</p>
    <div class="rolagem"><table class="tabela"><thead><tr><th>Depois de</th><th>Juros simples</th><th>Juros compostos</th></tr></thead><tbody>${prazos.map(([m, r]) => `<tr><td>${r}</td><td>${brl(simples(m))}</td><td><b>${brl(composto(m))}</b></td></tr>`).join("")}</tbody></table></div>
    <p class="nota">Em 20 anos, os juros compostos rendem ${((composto(240) - 1000) / (simples(240) - 1000)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} vezes mais que os simples. Por isso começar cedo pesa mais do que achar a taxa perfeita.</p>`;
  // 2. Quanto rende por mês
  renderRendaMensal();
  // 3. Cada investimento
  renderInvestimentosManual();
  // 4. Como usar o hub
  $("m-hub").innerHTML = `<h2>Como usar o hub</h2>
    <p class="nota">O que cada aba faz e como tirar proveito dela. Viu um <span class="termo termo-exemplo" aria-hidden="true">?</span> ao lado de um termo? Toque nele para ver a explicação.</p>
    <div class="guia">${Dados.GUIA_ABAS.map((a) => `
      <div class="guia-item">
        <h3>${esc(a.nome)}</h3>
        <p>${esc(a.paraQue)}</p>
        <ol>${a.passos.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
        <p class="dica-guia"><b>Dica:</b> ${esc(a.dica)}</p>
        <a class="botao fantasma pequeno" href="#${a.rota}">Abrir ${esc(a.nome)}</a>
      </div>`).join("")}</div>`;
  // 5. Glossário
  const termos = Object.entries(Dados.GLOSSARIO).sort((a, b) => a[1].termo.localeCompare(b[1].termo, "pt-BR"));
  $("m-glossario").innerHTML = `<h2>Glossário</h2><p class="nota">Os termos que aparecem no hub, em poucas palavras.</p>
    <dl class="glossario">${termos.map(([id, g]) => `<div class="glossario-item" id="g-${id}"><dt>${esc(g.termo)}</dt><dd>${esc(g.def)}</dd></div>`).join("")}</dl>`;
  if (termoPendente) { const t = termoPendente; termoPendente = null; requestAnimationFrame(() => destacarTermo(t)); }
}
RENDER.manual = renderManual;

// ---- Balão do glossário (botões "?")
let balao = null, termoPendente = null;
function fecharBalao() {
  if (!balao) return;
  balao.remove();
  balao = null;
  document.querySelectorAll('.termo[aria-expanded="true"]').forEach((b) => b.setAttribute("aria-expanded", "false"));
}
function abrirBalao(btn) {
  const id = btn.dataset.termo;
  const g = Dados.GLOSSARIO[id];
  if (!g) return;
  const mesmo = balao && balao.dataset.para === id;
  fecharBalao();
  if (mesmo) return;
  balao = document.createElement("div");
  balao.className = "balao";
  balao.dataset.para = id; // não usar data-termo aqui: é o seletor dos botões "?"
  balao.setAttribute("role", "dialog");
  balao.setAttribute("aria-label", g.termo);
  balao.innerHTML = `<strong>${esc(g.termo)}</strong><p>${esc(g.def)}</p><button type="button" class="botao-link" data-ver-termo="${id}">Ver no manual</button>`;
  document.body.appendChild(balao);
  const r = btn.getBoundingClientRect();
  const largura = Math.min(300, innerWidth - 32);
  balao.style.width = largura + "px";
  const esquerda = Math.max(16, Math.min(r.left + r.width / 2 - largura / 2, innerWidth - largura - 16));
  let topo = r.bottom + 8;
  if (topo + balao.offsetHeight > innerHeight - 8 && r.top - balao.offsetHeight - 8 > 0) topo = r.top - balao.offsetHeight - 8;
  balao.style.left = esquerda + scrollX + "px";
  balao.style.top = topo + scrollY + "px";
  btn.setAttribute("aria-expanded", "true");
}
function destacarTermo(id) {
  const el = $("g-" + id);
  if (!el) return;
  el.scrollIntoView({ block: "center" }); // salto direto: o destaque animado mostra onde está
  el.classList.remove("destacado");
  void el.offsetWidth; // reinicia a animação
  el.classList.add("destacado");
}
function verNoManual(id) {
  fecharBalao();
  if (rotaAtual === "manual") return destacarTermo(id);
  termoPendente = id;
  location.hash = "manual";
}

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

  // Glossário: abre o balão do "?", "Ver no manual" e fecha ao clicar fora.
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button.termo[data-termo]");
    if (t) { e.preventDefault(); abrirBalao(t); return; }
    const v = e.target.closest("[data-ver-termo]");
    if (v) { verNoManual(v.dataset.verTermo); return; }
    if (balao && !e.target.closest(".balao")) fecharBalao();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && balao) {
      const id = balao.dataset.para;
      fecharBalao();
      document.querySelector(`.termo[data-termo="${id}"]`)?.focus();
    }
  });
  window.addEventListener("resize", fecharBalao);

  // Manual: índice e calculadora de renda mensal
  document.querySelector(".manual-indice").addEventListener("click", (e) => {
    const b = e.target.closest("[data-secao]");
    if (!b) return;
    $(b.dataset.secao).scrollIntoView({ block: "start" });
  });
  $("form-renda").addEventListener("input", () => { renderRendaMensal(); renderInvestimentosManual(); });

  // Seus dados: copiar e colar entre aparelhos
  let dadosImportados = null;
  const statusDados = (msg, tipo = "") => { const el = $("dados-status"); el.textContent = msg; el.className = "status " + tipo; };
  $("dados-copiar").addEventListener("click", () => {
    const codigo = Calc.exportarCodigo(dadosParaSalvar());
    const mostrar = () => {
      const caixa = $("dados-codigo");
      caixa.value = codigo;
      caixa.hidden = false;
      caixa.select();
      statusDados("Não deu para copiar sozinho. Selecione o código abaixo e copie.");
    };
    try {
      navigator.clipboard.writeText(codigo).then(
        () => statusDados("Código copiado. No outro aparelho, abra o hub e use \"Colar dados de outro aparelho\".", "ok"),
        mostrar,
      );
    } catch {
      mostrar();
    }
  });
  $("dados-colar-abrir").addEventListener("click", () => { $("dados-importar").hidden = false; $("dados-entrada").focus(); });
  $("dados-cancelar").addEventListener("click", () => { $("dados-importar").hidden = true; $("dados-confirmar").hidden = true; statusDados(""); });
  $("dados-importar-btn").addEventListener("click", () => {
    try {
      dadosImportados = Calc.importarCodigo($("dados-entrada").value);
      if (!dadosImportados.perfil && !dadosImportados.carteira && !dadosImportados.produtosRF) throw new Error("Esse código não tem dados do Invest Simulador.");
      $("dados-confirmar").hidden = false;
      statusDados("");
      $("dados-confirmar-sim").focus();
    } catch (err) {
      $("dados-confirmar").hidden = true;
      statusDados(err.message, "erro");
    }
  });
  $("dados-confirmar-nao").addEventListener("click", () => { $("dados-confirmar").hidden = true; dadosImportados = null; });
  $("dados-confirmar-sim").addEventListener("click", () => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(dadosImportados));
      location.reload();
    } catch {
      statusDados("Este navegador não deixa salvar dados (modo anônimo ou bloqueio de cookies). Tente em uma janela normal.", "erro");
    }
  });
  $("btn-tema").addEventListener("click", () => aplicarTema(document.documentElement.dataset.tema !== "claro"));
  $("btn-topo").addEventListener("click", () => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  window.addEventListener("scroll", () => { $("btn-topo").dataset.oculto = window.scrollY > 900 ? "nao" : "sim"; }, { passive: true });
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
    estado.premissas[id] = { ...(estado.premissas[id] || {}), [campo]: Math.max(campo === "ret" ? -50 : 0, parseFloat(e.target.value) || 0) };
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
  const editarProduto = (e, redesenhar) => {
    const { i, campo } = e.target.dataset;
    if (i === undefined || !campo) return;
    const p = estado.produtosRF[+i];
    if (campo === "tipo") {
      if (p.tipo === e.target.value) return;
      p.tipo = e.target.value;
      p.pct = { cdi: 100, selic: 100, prefixado: 13, ipca: 7, poupanca: 100 }[p.tipo];
      redesenhar = true;
    } else if (["nome", "plataforma", "emissor"].includes(campo)) p[campo] = e.target.value;
    else if (campo === "isento") p.isento = e.target.checked;
    else p[campo] = Math.max(0, parseFloat(e.target.value) || 0);
    gravar();
    if (redesenhar) renderProdutos();
    atualizarSimulador();
  };
  $("tab-produtos").addEventListener("input", (e) => editarProduto(e, false));
  // Mudanças que habilitam ou desabilitam campos redesenham a tabela.
  $("tab-produtos").addEventListener("change", (e) => {
    if (["tipo", "teto"].includes(e.target.dataset.campo)) { editarProduto(e, true); }
  });
  $("tab-produtos").addEventListener("click", (e) => {
    const i = e.target.closest("[data-remover-rf]")?.dataset.removerRf;
    if (i === undefined) return;
    estado.produtosRF.splice(+i, 1);
    gravar(); renderProdutos(); atualizarSimulador();
  });
  $("rf-adicionar").addEventListener("click", () => {
    estado.produtosRF.push({ id: "p" + Date.now(), nome: "Novo CDB", tipo: "cdi", pct: 105, isento: false, teto: 0, pctAcima: 100, carencia: 0, plataforma: "", emissor: "", custodia: 0 });
    gravar(); renderProdutos(); atualizarSimulador(); tecladoNumerico();
    $(`rf-${estado.produtosRF.length - 1}-nome`).select();
  });
  $("rf-restaurar").addEventListener("click", () => {
    estado.produtosRF = Dados.PRODUTOS_RF.map((p) => ({ ...p }));
    gravar(); renderProdutos(); atualizarSimulador();
  });
  $("btn-taxas").addEventListener("click", carregarTaxas);
  $("form-reserva").addEventListener("input", atualizarReserva);
  $("form-meta").addEventListener("input", atualizarMeta);

  // Apps e corretoras
  $("ap-objetivos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-obj]");
    if (!b) return;
    estado.objetivo = b.dataset.obj;
    gravar();
    renderObjetivos();
    renderMelhor();
  });
  $("form-apps").addEventListener("input", (e) => {
    if (e.target.id === "ap-cdi") apCdiEditado = true;
    renderMelhor();
  });
  $("ap-tesouro").addEventListener("click", (e) => {
    const i = e.target.closest("[data-tesouro]")?.dataset.tesouro;
    if (i === undefined || !estado.tesouro) return;
    const novo = produtoDoTesouro(estado.tesouro.titulos[+i]);
    const j = estado.produtosRF.findIndex((p) => p.id === novo.id);
    if (j >= 0) estado.produtosRF[j] = novo;
    else estado.produtosRF.push(novo);
    gravar();
    renderTesouro();
    renderMelhor();
  });
  $("ap-filtro").addEventListener("click", (e) => {
    const b = e.target.closest("[data-fa]");
    if (!b) return;
    filtroApps = b.dataset.fa;
    renderCatalogoApps();
  });
  $("ap-catalogo").addEventListener("input", (e) => {
    const { app, custo } = e.target.dataset;
    if (!app) return;
    const v = parseFloat(e.target.value);
    estado.plataformas[app] = { ...(estado.plataformas[app] || {}), [custo]: Number.isFinite(v) ? Math.max(0, v) : 0 };
    gravar();
    e.target.closest(".app-cartao").querySelector(".ref").textContent = "Custos editados por você";
    renderMelhor();
  });
  $("ap-restaurar").addEventListener("click", () => {
    estado.plataformas = {};
    gravar();
    renderCatalogoApps();
    renderMelhor();
  });

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
  iniciarWorkerProjecao();
  $("btn-tema").setAttribute("aria-label", document.documentElement.dataset.tema === "claro" ? "Mudar para o tema preto" : "Mudar para o tema claro");
  if (estado.perfil.id) $("pj-carteira").value = estado.perfil.id;
  else $("pj-carteira").value = "moderado";
  renderFita();
  renderFonte();
  irPara(location.hash.slice(1) || "visao", false);
  carregarTaxas();
  carregarCripto();
  carregarTesouro();
})();
