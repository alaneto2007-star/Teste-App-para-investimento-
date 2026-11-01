// Funções de cálculo financeiro do Invest Simulador (sem dependências).
// Funciona no navegador (window.Calc) e no Node (module.exports), para testes.

(function (root) {
  // ---------- Renda fixa ----------

  // Converte taxa anual (ex.: 0.15 = 15% a.a.) em taxa mensal equivalente.
  function taxaMensal(taxaAnual) {
    return Math.pow(1 + taxaAnual, 1 / 12) - 1;
  }

  // Alíquota de IR regressivo da renda fixa, pelo prazo em meses (~30 dias cada).
  function aliquotaIR(meses) {
    const dias = meses * 30;
    if (dias <= 180) return 0.225;
    if (dias <= 360) return 0.2;
    if (dias <= 720) return 0.175;
    return 0.15;
  }

  // Rendimento anual da poupança: 0,5% a.m. se Selic > 8,5%; senão 70% da Selic (TR ignorada).
  function taxaPoupanca(selicAnual) {
    if (selicAnual > 0.085) return Math.pow(1.005, 12) - 1;
    return 0.7 * selicAnual;
  }

  // Valor futuro trazido para "reais de hoje", descontando a inflação anual.
  function valorReal(valor, inflacaoAnual, meses) {
    return valor / Math.pow(1 + inflacaoAnual, meses / 12);
  }

  // Simula aportes mensais com juros compostos.
  // Retorna a evolução mês a mês e o resultado final (bruto, IR, líquido e valor real).
  function simular({ inicial, mensal, meses, taxaAnual, isento, inflacao = 0 }) {
    const i = taxaMensal(taxaAnual);
    let saldo = inicial;
    let investido = inicial;
    const evolucao = [{ mes: 0, saldo, investido }];
    for (let m = 1; m <= meses; m++) {
      saldo = saldo * (1 + i) + mensal;
      investido += mensal;
      evolucao.push({ mes: m, saldo, investido });
    }
    const lucro = saldo - investido;
    const ir = isento || lucro <= 0 ? 0 : lucro * aliquotaIR(meses);
    const real = valorReal(saldo - ir, inflacao, meses);
    return {
      evolucao,
      investido,
      bruto: saldo,
      ir,
      liquido: saldo - ir,
      lucroLiquido: lucro - ir,
      real, // valor líquido em reais de hoje
    };
  }

  // Monta os produtos de renda fixa comparados a partir das taxas informadas.
  function produtos({ selic, cdi, pctCdb, pctLci }) {
    return [
      { id: "poupanca", nome: "Poupança", taxaAnual: taxaPoupanca(selic), isento: true },
      { id: "selic", nome: "Tesouro Selic", taxaAnual: selic, isento: false },
      { id: "cdb", nome: `CDB ${Math.round(pctCdb * 100)}% CDI`, taxaAnual: cdi * pctCdb, isento: false },
      { id: "lci", nome: `LCI/LCA ${Math.round(pctLci * 100)}% CDI`, taxaAnual: cdi * pctLci, isento: true },
    ];
  }

  // Reserva de emergência recomendada: gastos mensais x meses (6 CLT, 3 servidor, 12 autônomo).
  function reservaEmergencia(gastoMensal, perfil) {
    const meses = perfil === "autonomo" ? 12 : perfil === "publico" ? 3 : 6;
    return { meses, valor: gastoMensal * meses };
  }

  // Quantos meses para atingir um valor-alvo com aportes mensais.
  function mesesParaMeta({ inicial, mensal, alvo, taxaAnual }) {
    const i = taxaMensal(taxaAnual);
    let saldo = inicial;
    let m = 0;
    while (saldo < alvo) {
      if (m >= 1200) return null; // > 100 anos: inatingível na prática
      saldo = saldo * (1 + i) + mensal;
      m++;
    }
    return m;
  }

  // Taxa anual de um título que paga pct% do CDI (ou da Selic). O percentual incide sobre a taxa DIÁRIA
  // (252 dias úteis), como fazem bancos e corretoras: 115% do CDI de 14,9% dá ≈ 17,4% a.a., não 17,1%.
  function taxaPctCDI(indiceAnual, pct) {
    const diaria = Math.pow(1 + indiceAnual, 1 / 252) - 1;
    return Math.pow(1 + (diaria * pct) / 100, 252) - 1;
  }

  // Taxa anual bruta de um produto de renda fixa, já descontada a custódia (% a.a.), se houver.
  // Tipos: "cdi" e "selic" (pct = % do índice), "poupanca", "prefixado" (pct = % ao ano) e
  // "ipca" (pct = juro real; rende (1 + IPCA) × (1 + pct) − 1, com o IPCA de mkt.ipca constante).
  // acima = true usa a taxa do saldo que passa do teto (pctAcima, sempre em % do CDI).
  function taxaProduto(prod, { cdi, selic, ipca = 0 }, acima = false) {
    let r;
    if (prod.tipo === "poupanca") r = taxaPoupanca(selic);
    else if (acima) r = taxaPctCDI(cdi, prod.pctAcima ?? 100);
    else if (prod.tipo === "prefixado") r = prod.pct / 100;
    else if (prod.tipo === "ipca") r = (1 + ipca) * (1 + prod.pct / 100) - 1;
    else r = taxaPctCDI(prod.tipo === "selic" ? selic : cdi, prod.pct);
    return prod.custodia ? (1 + r) * (1 - prod.custodia / 100) - 1 : r;
  }

  // Dá para resgatar a qualquer dia sem perder a taxa? Carência, prefixados e IPCA+ (marcação a mercado) não.
  function temLiquidezDiaria(prod) {
    return !(prod.carencia > 0) && prod.tipo !== "prefixado" && prod.tipo !== "ipca";
  }

  // Título com vencimento (ex.: Tesouro Prefixado): a taxa vale até o vencimento (guardado em "carencia").
  // Depois dele, o dinheiro é reaplicado a 100% do CDI.
  const venceuEm = (prod) => (prod.vencimento ? prod.carencia || 0 : Infinity);

  // Rendimento líquido de IR, expresso em % do CDI, para um prazo em meses (ignora o teto).
  function equivalenteLiquido(prod, meses, mkt) {
    const r = taxaProduto(prod, mkt);
    const ateVencer = Math.min(meses, venceuEm(prod));
    const ganho = Math.pow(1 + r, ateVencer / 12) * Math.pow(1 + mkt.cdi, (meses - ateVencer) / 12) - 1;
    const aliq = prod.isento ? 0 : aliquotaIR(meses);
    const liquidoAnual = Math.pow(1 + ganho * (1 - aliq), 12 / meses) - 1;
    const d = (x) => Math.pow(1 + x, 1 / 252) - 1;
    return (d(liquidoAnual) / d(mkt.cdi)) * 100;
  }

  // Simula um ou mais produtos de renda fixa com aporte inicial e mensal.
  // distribuir = true: cada aporte vai para o produto com melhor rendimento líquido no prazo, respeitando o teto
  // (o que não cabe vai para o próximo). Produtos com carência maior que o prazo ficam de fora.
  // distribuir = false: todo o dinheiro vai para o primeiro produto; o saldo acima do teto rende pctAcima.
  // O IR é calculado por aporte, conforme o tempo que cada um ficou aplicado (tabela regressiva).
  function simularPlano({ produtos, inicial, mensal, meses, cdi, selic, ipca = 0, inflacao = 0, distribuir = true }) {
    const mkt = { cdi, selic, ipca };
    const validos = produtos.filter((p) => (p.carencia || 0) <= meses);
    const ordem = distribuir
      ? [...validos].sort((a, b) => equivalenteLiquido(b, meses, mkt) - equivalenteLiquido(a, meses, mkt))
      : validos.slice(0, 1);
    if (!ordem.length) return null;
    const iCDI = Math.pow(1 + cdi, 1 / 12) - 1;
    const st = ordem.map((p) => ({
      prod: p, saldo: 0, lotes: [], vence: venceuEm(p),
      i1: Math.pow(1 + taxaProduto(p, mkt), 1 / 12) - 1,
      i2: Math.pow(1 + taxaProduto(p, mkt, true), 1 / 12) - 1,
    }));
    function aplicar(valor, mes) {
      for (const e of st) {
        if (valor <= 0) break;
        if (distribuir && mes >= e.vence) continue; // título vencido não recebe aporte novo
        const espaco = distribuir && e.prod.teto > 0 ? Math.max(0, e.prod.teto - e.saldo) : Infinity;
        const v = Math.min(valor, espaco);
        if (v > 0) { e.lotes.push({ principal: v, atual: v, mes }); e.saldo += v; valor -= v; }
      }
      if (valor > 0) { st[0].lotes.push({ principal: valor, atual: valor, mes }); st[0].saldo += valor; } // todos no teto
    }
    aplicar(inicial, 0);
    let investido = inicial;
    const evolucao = [{ mes: 0, saldo: inicial, investido }];
    for (let m = 1; m <= meses; m++) {
      for (const e of st) {
        if (e.saldo <= 0) continue;
        const base = e.prod.teto > 0 ? Math.min(e.saldo, e.prod.teto) : e.saldo;
        const novo = m > e.vence ? e.saldo * (1 + iCDI) : base * (1 + e.i1) + (e.saldo - base) * (1 + e.i2);
        const fator = novo / e.saldo;
        e.lotes.forEach((l) => (l.atual *= fator));
        e.saldo = novo;
      }
      aplicar(mensal, m);
      investido += mensal;
      evolucao.push({ mes: m, saldo: st.reduce((a, e) => a + e.saldo, 0), investido });
    }
    const porProduto = st.map((e) => {
      const aportado = e.lotes.reduce((a, l) => a + l.principal, 0);
      const ir = e.prod.isento ? 0 : e.lotes.reduce((a, l) => a + Math.max(0, l.atual - l.principal) * aliquotaIR(meses - l.mes), 0);
      return { prod: e.prod, aportado, bruto: e.saldo, ir, liquido: e.saldo - ir };
    });
    const bruto = porProduto.reduce((a, p) => a + p.bruto, 0);
    const ir = porProduto.reduce((a, p) => a + p.ir, 0);
    const liquido = bruto - ir;
    return {
      porProduto, evolucao, investido, bruto, ir, liquido,
      lucroLiquido: liquido - investido,
      real: valorReal(liquido, inflacao, meses),
      foraPorCarencia: produtos.filter((p) => (p.carencia || 0) > meses),
    };
  }

  // Soma o saldo por emissor e marca quem passa do limite do FGC (R$ 250 mil por CPF e instituição).
  // Títulos do Tesouro ficam de fora (garantia do governo). Sem emissor informado, cada produto conta sozinho.
  function concentracaoFGC(porProduto, limite = 250000, emissorTesouro = "Tesouro Nacional") {
    const grupos = new Map();
    porProduto.forEach((x) => {
      const emissor = (x.prod.emissor || "").trim();
      if (emissor === emissorTesouro) return;
      const chave = emissor ? emissor.toLowerCase() : "produto:" + (x.prod.id || x.prod.nome);
      const g = grupos.get(chave) || { emissor: emissor || x.prod.nome, valor: 0, produtos: [] };
      g.valor += x.bruto;
      g.produtos.push(x.prod.nome);
      grupos.set(chave, g);
    });
    return [...grupos.values()].map((g) => ({ ...g, excede: g.valor > limite })).sort((a, b) => b.valor - a.valor);
  }

  // ---------- Custos de plataformas ----------

  // Custo anual de comprar ações, ETFs ou FIIs: corretagem por ordem + taxas da B3 (% do volume) + custódia.
  function custoAcoes({ valorOrdem, ordensMes, saldo = 0, corretagem = 0, custodiaPct = 0, taxaB3Pct = 0.03 }) {
    const ordensAno = ordensMes * 12;
    const volumeAno = valorOrdem * ordensAno;
    const b3 = (volumeAno * taxaB3Pct) / 100;
    const corr = corretagem * ordensAno;
    const cust = (saldo * custodiaPct) / 100;
    const total = b3 + corr + cust;
    return { b3, corretagem: corr, custodia: cust, total, pctAportes: volumeAno ? (total / volumeAno) * 100 : 0 };
  }

  // Custo de comprar e depois vender cripto, com taxa (ou spread) de t% em cada operação.
  function custoCripto({ valor, taxaPct }) {
    const volta = valor * Math.pow(1 - taxaPct / 100, 2);
    return { custo: valor - volta, volta, pct: valor ? ((valor - volta) / valor) * 100 : 0 };
  }

  // Envio de reais para uma conta de investimento no exterior: IOF e spread de câmbio saem do valor.
  function custoExterior({ valor, spreadPct, iofPct, dolar }) {
    const chega = valor * (1 - iofPct / 100) * (1 - spreadPct / 100);
    return { chega, custo: valor - chega, emDolar: dolar ? chega / dolar : null, pct: valor ? ((valor - chega) / valor) * 100 : 0 };
  }

  // Renda mensal média de um valor aplicado a uma taxa anual, já descontado o IR (fração, ex.: 0,15).
  function rendaMensal({ valor, taxaAnual, ir = 0 }) {
    return valor * (Math.pow(1 + taxaAnual, 1 / 12) - 1) * (1 - ir);
  }

  // ---------- Backup dos dados (levar para outro aparelho) ----------
  const PREFIXO_CODIGO = "IS1:";

  // Objeto -> texto "IS1:" + base64 do JSON em UTF-8 (acentos preservados).
  function exportarCodigo(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return PREFIXO_CODIGO + btoa(bin);
  }

  // Texto -> objeto. Erros com mensagens que dizem ao usuário o que fazer.
  function importarCodigo(texto) {
    const t = String(texto || "").replace(/\s+/g, "");
    if (!t.startsWith(PREFIXO_CODIGO)) throw new Error("O código precisa começar com IS1:. Copie o código inteiro no outro aparelho e cole de novo.");
    let obj;
    try {
      const bin = atob(t.slice(PREFIXO_CODIGO.length));
      obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    } catch {
      throw new Error("O código está incompleto ou foi alterado. Copie de novo no outro aparelho.");
    }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("Esse código não tem dados do Invest Simulador.");
    return obj;
  }

  // Juro real pela equação de Fisher: (1 + nominal) / (1 + inflação) - 1.
  function juroReal(nominal, inflacao) {
    return (1 + nominal) / (1 + inflacao) - 1;
  }

  // ---------- Estatísticas de séries anuais ----------

  // Recebe retornos anuais em % e devolve métricas de risco e retorno.
  function estatisticas(retornosPct) {
    const r = retornosPct.map((x) => x / 100);
    const n = r.length;
    let indice = 1, pico = 1, quedaMax = 0;
    for (const x of r) {
      indice *= 1 + x;
      pico = Math.max(pico, indice);
      quedaMax = Math.min(quedaMax, indice / pico - 1);
    }
    const media = r.reduce((a, b) => a + b, 0) / n;
    const vol = n > 1 ? Math.sqrt(r.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1)) : 0;
    return {
      cagr: Math.pow(indice, 1 / n) - 1,
      acumulado: indice - 1,
      vol,
      melhor: Math.max(...r),
      pior: Math.min(...r),
      anosNegativos: r.filter((x) => x < 0).length,
      quedaMax, // queda máxima medida em fechamentos anuais
    };
  }

  // Retorno anual (%) de uma carteira rebalanceada todo ano.
  // alocacao: { id: peso% }, historicos: { id: [retornos %] }
  function retornosCarteira(alocacao, historicos) {
    const ids = Object.keys(alocacao).filter((id) => alocacao[id] > 0);
    const total = ids.reduce((s, id) => s + alocacao[id], 0) || 1;
    const n = historicos[ids[0]]?.length ?? 0;
    return Array.from({ length: n }, (_, ano) =>
      ids.reduce((s, id) => s + (alocacao[id] / total) * historicos[id][ano], 0)
    );
  }

  // Backtest com aporte inicial e mensal sobre retornos anuais (%).
  // O retorno de cada ano é distribuído em 12 meses com taxa composta equivalente.
  // inflacaoPct (opcional) devolve também os valores em reais do início do período.
  // custoPct: custo anual descontado do retorno de cada ano (taxa de ETF, custódia, spread).
  function backtest({ retornosPct, inicial, mensal, inflacaoPct, custoPct = 0 }) {
    let saldo = inicial, investido = inicial, deflator = 1;
    const pontos = [{ ano: 0, saldo, investido, real: saldo, deflator }];
    retornosPct.forEach((r, a) => {
      const i = Math.pow((1 + r / 100) * (1 - custoPct / 100), 1 / 12) - 1;
      for (let m = 0; m < 12; m++) {
        saldo = saldo * (1 + i) + mensal;
        investido += mensal;
      }
      if (inflacaoPct) deflator *= 1 + inflacaoPct[a] / 100;
      pontos.push({ ano: a + 1, saldo, investido, real: saldo / deflator, deflator });
    });
    return pontos;
  }

  // ---------- Monte Carlo ----------

  // Gerador pseudoaleatório com semente (mulberry32): resultados reproduzíveis.
  function gerador(semente) {
    let a = semente >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Normal padrão (Box-Muller).
  function normal(rand) {
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  }

  // Decomposição de Cholesky (L tal que L·Lᵀ = M). Ajusta a diagonal se a matriz não for positiva definida.
  function cholesky(M) {
    const n = M.length;
    for (let ajuste = 0; ajuste < 10; ajuste++) {
      const L = Array.from({ length: n }, () => new Array(n).fill(0));
      let ok = true;
      for (let i = 0; i < n && ok; i++) {
        for (let j = 0; j <= i; j++) {
          let s = M[i][j] + (i === j ? ajuste * 0.01 : 0);
          for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
          if (i === j) {
            if (s <= 0) { ok = false; break; }
            L[i][j] = Math.sqrt(s);
          } else L[i][j] = s / L[j][j];
        }
      }
      if (ok) return L;
    }
    throw new Error("Matriz de correlação inválida");
  }

  function percentil(ordenado, p) {
    const idx = (ordenado.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return ordenado[lo] + (ordenado[hi] - ordenado[lo]) * (idx - lo);
  }

  // Simula a carteira mês a mês em TERMOS REAIS (reais de hoje), com retornos log-normais correlacionados
  // e rebalanceamento mensal. Os aportes mensais são corrigidos pela inflação.
  // premissas: { id: { ret: % real anual mediano, vol: % anual, custo: % a.a., ir: alíquota % } }
  // descontarIR: aplica o IR sobre o ganho NOMINAL no resgate (o imposto também incide sobre a inflação).
  function monteCarlo({ alocacao, premissas, ids, correlacao, inicial, mensal, anos, inflacao = 0, descontarIR = false, sims = 2000, semente = 42 }) {
    const meses = Math.round(anos * 12);
    const n = ids.length;
    const pesos = ids.map((id) => (alocacao[id] || 0) / 100);
    const somaPesos = pesos.reduce((a, b) => a + b, 0) || 1;
    const w = pesos.map((p) => p / somaPesos);
    const mu = ids.map((id) => Math.log(1 + premissas[id].ret / 100) / 12 + Math.log(1 - (premissas[id].custo || 0) / 100) / 12);
    const sig = ids.map((id) => premissas[id].vol / 100 / Math.sqrt(12));
    const aliquota = descontarIR ? ids.reduce((s, id, i) => s + w[i] * (premissas[id].ir || 0), 0) / 100 : 0;
    const L = cholesky(correlacao);
    const rand = gerador(semente);

    // Inflação acumulada e total investido em valores nominais, mês a mês.
    const inflM = Math.pow(1 + inflacao / 100, 1 / 12);
    const defl = new Float64Array(meses + 1), invNom = new Float64Array(meses + 1);
    defl[0] = 1; invNom[0] = inicial;
    for (let m = 1; m <= meses; m++) { defl[m] = defl[m - 1] * inflM; invNom[m] = invNom[m - 1] + mensal * defl[m]; }
    // Valor líquido (em reais de hoje) de um saldo real v no mês m, após o IR sobre o ganho nominal.
    const liquido = (v, m) => v - (aliquota * Math.max(0, v * defl[m] - invNom[m])) / defl[m];

    const valores = new Float64Array((meses + 1) * sims); // [mes * sims + s]
    const quedas = new Float64Array(sims);
    const z = new Float64Array(n);
    for (let s = 0; s < sims; s++) {
      let saldo = inicial, indice = 1, pico = 1, quedaMax = 0;
      valores[s] = saldo;
      for (let m = 1; m <= meses; m++) {
        for (let k = 0; k < n; k++) z[k] = normal(rand);
        let r = 0;
        for (let i = 0; i < n; i++) {
          if (w[i] === 0) continue;
          let c = 0;
          for (let k = 0; k <= i; k++) c += L[i][k] * z[k];
          r += w[i] * (Math.exp(mu[i] + sig[i] * c) - 1);
        }
        saldo = saldo * (1 + r) + mensal;
        indice *= 1 + r;
        pico = Math.max(pico, indice);
        quedaMax = Math.min(quedaMax, indice / pico - 1);
        valores[m * sims + s] = saldo;
      }
      quedas[s] = quedaMax;
    }

    // O líquido é crescente no saldo, então o percentil do líquido = líquido do percentil.
    const faixas = [0.05, 0.25, 0.5, 0.75, 0.95];
    const serie = [];
    const buf = new Float64Array(sims);
    for (let m = 0; m <= meses; m++) {
      for (let s = 0; s < sims; s++) buf[s] = valores[m * sims + s];
      buf.sort();
      const p = faixas.map((f) => liquido(percentil(buf, f), m));
      const bruto50 = percentil(buf, 0.5);
      serie.push({ mes: m, investido: inicial + mensal * m, p5: p[0], p25: p[1], p50: p[2], p75: p[3], p95: p[4], bruto50 });
    }

    const investido = inicial + mensal * meses; // em reais de hoje
    let perdas = 0;
    for (let s = 0; s < sims; s++) if (liquido(valores[meses * sims + s], meses) < investido) perdas++;
    const quedasOrd = Array.from(quedas).sort((a, b) => a - b);
    const final = serie[meses];
    return {
      serie,
      investido,
      investidoNominal: invNom[meses],
      final,
      deflator: defl[meses],
      aliquota,
      irMediano: final.bruto50 - final.p50, // IR do cenário mediano, em reais de hoje
      probPerda: perdas / sims, // chance de terminar abaixo do investido corrigido pela inflação
      quedaMediana: percentil(quedasOrd, 0.5),
      quedaRuim: percentil(quedasOrd, 0.05),
      retornoEsperado: ids.reduce((s, id, i) => s + w[i] * premissas[id].ret, 0),
      custoMedio: ids.reduce((s, id, i) => s + w[i] * (premissas[id].custo || 0), 0),
    };
  }

  // ---------- Perfil e carteira ----------

  // respostas: array com a opção escolhida (0 a 3) em cada questão.
  function perfilPorRespostas(respostas) {
    const pontos = respostas.reduce((s, r) => s + r + 1, 0);
    const max = respostas.length * 4;
    const pct = (pontos - respostas.length) / (max - respostas.length); // 0 a 1
    let id = pct <= 0.3 ? "conservador" : pct <= 0.55 ? "moderado" : pct <= 0.8 ? "arrojado" : "agressivo";
    let alerta = null;
    // Sem reserva de emergência ou com prazo curto, o perfil é limitado.
    if (respostas[4] === 0 && (id === "arrojado" || id === "agressivo")) {
      id = "moderado";
      alerta = "Você ainda não tem reserva de emergência. Monte a reserva antes de assumir mais risco.";
    }
    if (respostas[0] === 0 && id !== "conservador") {
      id = "conservador";
      alerta = "Dinheiro que você vai usar em menos de 1 ano deve ficar em renda fixa com liquidez.";
    }
    return { pontos, max, pct, id, alerta };
  }

  // Divide um aporte entre as classes que estão mais abaixo do alvo.
  // atual: { id: valor R$ }, alvo: { id: peso% }. Retorna { id: valor do aporte }.
  function rebalancear(atual, alvo, aporte) {
    const ids = Object.keys(alvo);
    const totalFinal = ids.reduce((s, id) => s + (atual[id] || 0), 0) + aporte;
    const falta = {};
    ids.forEach((id) => (falta[id] = Math.max(0, (alvo[id] / 100) * totalFinal - (atual[id] || 0))));
    const somaFalta = ids.reduce((s, id) => s + falta[id], 0);
    const resultado = {};
    ids.forEach((id) => {
      resultado[id] = somaFalta > 0 ? (falta[id] / somaFalta) * aporte : (alvo[id] / 100) * aporte;
    });
    return resultado;
  }

  const Calc = {
    taxaMensal, valorReal, aliquotaIR, taxaPoupanca, simular, produtos, reservaEmergencia, mesesParaMeta, juroReal,
    taxaPctCDI, taxaProduto, temLiquidezDiaria, equivalenteLiquido, simularPlano, concentracaoFGC,
    custoAcoes, custoCripto, custoExterior, rendaMensal, exportarCodigo, importarCodigo,
    estatisticas, retornosCarteira, backtest, gerador, cholesky, monteCarlo, perfilPorRespostas, rebalancear,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Calc;
  else root.Calc = Calc;
})(typeof window !== "undefined" ? window : globalThis);
