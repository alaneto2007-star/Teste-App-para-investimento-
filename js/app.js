// Interface do Invest Simulador. Usa as funções de js/calc.js (window.Calc).

const $ = (id) => document.getElementById(id);
const pct = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = (id) => Math.max(0, parseFloat($(id).value) || 0);
const CORES = ["--c1", "--c2", "--c3", "--c4"];
const cor = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function textoPrazo(meses) {
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  const partes = [];
  if (a) partes.push(a + (a === 1 ? " ano" : " anos"));
  if (m) partes.push(m + (m === 1 ? " mês" : " meses"));
  return partes.join(" e ") || "0 meses";
}

function escapar(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Abas ----------
document.querySelectorAll(".aba").forEach((botao) => {
  botao.addEventListener("click", () => {
    document.querySelectorAll(".aba").forEach((b) => b.classList.toggle("ativa", b === botao));
    document.querySelectorAll(".painel").forEach((p) => p.classList.toggle("ativo", p.id === botao.dataset.aba));
  });
});

// ---------- Simulador ----------
function atualizarSimulador() {
  const meses = Math.max(1, Math.min(600, Math.round(num("meses"))));
  const base = { inicial: num("inicial"), mensal: num("mensal"), meses, inflacao: num("ipca") / 100 };
  const lista = Calc.produtos({
    selic: num("selic") / 100,
    cdi: num("cdi") / 100,
    pctCdb: num("pctCdb") / 100,
    pctLci: num("pctLci") / 100,
  });
  const resultados = lista.map((p, idx) => ({ ...p, cor: cor(CORES[idx]), r: Calc.simular({ ...base, ...p }) }));
  const melhor = resultados.reduce((a, b) => (b.r.liquido > a.r.liquido ? b : a));

  $("prazo-txt").textContent = textoPrazo(meses);
  $("total-investido").textContent = brl.format(resultados[0].r.investido);
  $("tabela-res").innerHTML = resultados
    .map(
      (p) => `<tr class="${p === melhor ? "melhor" : ""}">
        <td><span class="ponto" style="background:${p.cor}"></span>${escapar(p.nome)}</td>
        <td>${brl.format(p.r.bruto)}</td>
        <td>${brl.format(p.r.ir)}</td>
        <td>${brl.format(p.r.liquido)}</td>
        <td>${brl.format(p.r.lucroLiquido)}</td>
        <td class="${p.r.real < p.r.investido ? "perda" : ""}">${brl.format(p.r.real)}</td>
      </tr>`
    )
    .join("");

  desenharGrafico(resultados, meses);
}

// Gráfico de linhas em SVG puro (sem bibliotecas).
function desenharGrafico(resultados, meses) {
  const L = 640, A = 260, mE = 70, mD = 10, mT = 10, mB = 28;
  const w = L - mE - mD, h = A - mT - mB;
  const max = Math.max(...resultados.map((p) => p.r.bruto)) || 1;
  const x = (m) => mE + (m / meses) * w;
  const y = (v) => mT + h - (v / max) * h;
  const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

  let svg = `<svg viewBox="0 0 ${L} ${A}" role="img">`;
  for (let k = 0; k <= 4; k++) {
    const v = (max * k) / 4;
    svg += `<line class="eixo" x1="${mE}" x2="${L - mD}" y1="${y(v)}" y2="${y(v)}" />`;
    svg += `<text x="${mE - 6}" y="${y(v) + 4}" text-anchor="end">R$ ${compacto.format(v)}</text>`;
  }
  svg += `<text x="${mE}" y="${A - 8}">0</text><text x="${L - mD}" y="${A - 8}" text-anchor="end">${meses} meses</text>`;

  // Linha tracejada do valor investido.
  const inv = resultados[0].r.evolucao.map((e) => `${x(e.mes).toFixed(1)},${y(e.investido).toFixed(1)}`).join(" ");
  svg += `<polyline points="${inv}" fill="none" stroke="${cor("--suave")}" stroke-width="1.5" stroke-dasharray="4 4" />`;

  resultados.forEach((p) => {
    const pts = p.r.evolucao.map((e) => `${x(e.mes).toFixed(1)},${y(e.saldo).toFixed(1)}`).join(" ");
    svg += `<polyline points="${pts}" fill="none" stroke="${p.cor}" stroke-width="2.5" stroke-linejoin="round" />`;
  });
  svg += "</svg>";
  $("grafico").innerHTML = svg;

  $("legenda").innerHTML =
    resultados.map((p) => `<span><span class="ponto" style="background:${p.cor}"></span>${escapar(p.nome)}</span>`).join("") +
    `<span>- - - Valor investido</span>`;
}

$("form-sim").addEventListener("input", atualizarSimulador);

// ---------- Taxas do Banco Central (API SGS) ----------
// 432 = Selic meta (% a.a.), 4389 = CDI anualizado (% a.a.), 13522 = IPCA acumulado 12 meses (%)
const SERIES = { selic: 432, cdi: 4389, ipca: 13522 };

async function buscarSerie(codigo) {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/1?formato=json`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  const [ultimo] = await resp.json();
  const valor = parseFloat(String(ultimo.valor).replace(",", "."));
  if (!Number.isFinite(valor)) throw new Error("valor inválido");
  return { valor, data: ultimo.data };
}

async function atualizarTaxas() {
  const status = $("status-taxas");
  status.className = "status";
  status.textContent = "Buscando taxas no Banco Central…";
  const resultados = await Promise.allSettled(Object.values(SERIES).map(buscarSerie));
  const ok = [];
  Object.keys(SERIES).forEach((campo, i) => {
    const r = resultados[i];
    if (r.status === "fulfilled") {
      $(campo).value = r.value.valor.toFixed(2);
      ok.push(r.value.data);
    }
  });
  if (ok.length === 0) {
    status.textContent = "Não foi possível buscar as taxas agora. Usando os valores digitados.";
  } else {
    status.className = "status ok";
    status.textContent =
      `Taxas do Banco Central de ${ok[0]}` + (ok.length < 3 ? " (algumas não carregaram; confira os campos)" : "") + ".";
  }
  atualizarSimulador();
}
$("btn-taxas").addEventListener("click", atualizarTaxas);
$("form-sim").addEventListener("submit", (e) => e.preventDefault());

// ---------- Reserva e metas ----------
function atualizarReserva() {
  const r = Calc.reservaEmergencia(num("gastos"), $("perfil").value);
  $("res-reserva").innerHTML = `Sua reserva ideal:<span class="grande">${brl.format(r.valor)}</span>${r.meses} meses de gastos`;
}

function atualizarMeta() {
  const m = Calc.mesesParaMeta({
    inicial: num("meta-inicial"),
    mensal: num("meta-mensal"),
    alvo: num("alvo"),
    taxaAnual: num("meta-taxa") / 100,
  });
  $("res-meta").innerHTML =
    m === null
      ? "Com esses valores a meta levaria mais de 100 anos. Tente aumentar o aporte."
      : m === 0
      ? "Você já atingiu essa meta!"
      : `Você chega lá em:<span class="grande">${textoPrazo(m)}</span>`;
}

["form-reserva", "form-meta"].forEach((id) => {
  $(id).addEventListener("submit", (e) => e.preventDefault());
});
$("form-reserva").addEventListener("input", atualizarReserva);
$("form-meta").addEventListener("input", atualizarMeta);

// ---------- Carteira (salva no localStorage) ----------
const CHAVE = "invest-simulador:carteira";
const CORES_CAT = {
  "Renda fixa": "#2563eb", "Ações": "#d97706", "FIIs": "#7c3aed", "ETFs": "#0f7b5f",
  "Exterior": "#0891b2", "Cripto": "#db2777", "Outros": "#8a94a6",
};

function carregarCarteira() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || [];
  } catch {
    return [];
  }
}
let carteira = carregarCarteira();

function salvarCarteira() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(carteira));
  } catch {
    /* navegador sem armazenamento: segue só em memória */
  }
}

function atualizarCarteira() {
  const total = carteira.reduce((s, a) => s + a.valor, 0);
  $("total-carteira").textContent = brl.format(total);

  const porCat = {};
  carteira.forEach((a) => (porCat[a.cat] = (porCat[a.cat] || 0) + a.valor));
  $("barras").innerHTML = Object.entries(porCat)
    .map(([c, v]) => `<div title="${c}: ${pct((v / total) * 100)}" style="width:${(v / total) * 100}%;background:${CORES_CAT[c]}"></div>`)
    .join("");

  $("lista-ativos").innerHTML = carteira.length
    ? carteira
        .map(
          (a, i) => `<li>
            <span class="ponto" style="background:${CORES_CAT[a.cat]}"></span>
            <span class="nome">${escapar(a.nome)}<br /><span class="cat">${a.cat} · ${pct(total ? (a.valor / total) * 100 : 0)}</span></span>
            <span class="valor">${brl.format(a.valor)}</span>
            <button data-remover="${i}" aria-label="Remover ${escapar(a.nome)}">✕</button>
          </li>`
        )
        .join("")
    : `<li class="vazio">Nenhum investimento ainda. Adicione o primeiro ao lado.</li>`;
}

$("form-ativo").addEventListener("submit", (e) => {
  e.preventDefault();
  const nome = $("ativo-nome").value.trim();
  const valor = parseFloat($("ativo-valor").value);
  if (!nome || !(valor > 0)) return;
  carteira.push({ nome, cat: $("ativo-cat").value, valor });
  salvarCarteira();
  atualizarCarteira();
atualizarTaxas();
  e.target.reset();
  $("ativo-nome").focus();
});

$("lista-ativos").addEventListener("click", (e) => {
  const i = e.target.dataset.remover;
  if (i === undefined) return;
  carteira.splice(Number(i), 1);
  salvarCarteira();
  atualizarCarteira();
atualizarTaxas();
});

// ---------- Inicialização ----------
atualizarSimulador();
atualizarReserva();
atualizarMeta();
atualizarCarteira();
atualizarTaxas();
