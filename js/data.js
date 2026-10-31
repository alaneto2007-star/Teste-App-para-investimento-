// Dados de referência do Invest Simulador.
// Retornos anuais APROXIMADOS (fim de ano a fim de ano), compilados de séries públicas:
// CDI e IPCA (BCB/IBGE), IMA-B (Anbima), Ibovespa e IFIX (B3), S&P 500 com dividendos,
// ouro, Bitcoin e Ethereum em dólar convertidos pelo câmbio de fim de ano.
// São para estudo: confira nas fontes oficiais antes de tomar decisões.

(function (root) {
  const ANOS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

  // Variação do dólar (R$) no ano, usada para converter ativos cotados em dólar.
  const DOLAR = [-16.5, 1.5, 17.1, 4.0, 28.9, 7.4, -6.5, -7.2, 27.7];

  // Retornos em dólar (%) dos ativos externos.
  const EM_DOLAR = {
    sp500: [12.0, 21.8, -4.4, 31.5, 18.4, 28.7, -18.1, 26.3, 25.0],
    ouro: [8.6, 13.1, -1.6, 18.3, 25.1, -3.6, -0.3, 13.1, 27.2],
    btc: [125, 1331, -73, 92, 303, 60, -64, 155, 121],
    eth: [760, 9165, -82, -3, 471, 399, -67.5, 91, 46],
  };

  const emReais = (usd) => usd.map((r, i) => +(((1 + r / 100) * (1 + DOLAR[i] / 100) - 1) * 100).toFixed(1));

  // Classes de ativo. A ordem segue os slots da paleta de gráficos (--s1 … --s8).
  const CLASSES = [
    {
      id: "cdi", nome: "Renda fixa pós (CDI)", curto: "CDI", risco: 1,
      hist: [14.0, 9.93, 6.42, 5.96, 2.76, 4.42, 12.39, 13.04, 10.88],
      desc: "Tesouro Selic, CDBs e LCIs atrelados ao CDI.",
    },
    {
      id: "ipca", nome: "Tesouro IPCA+ (IMA-B)", curto: "IPCA+", risco: 3,
      hist: [24.81, 12.79, 13.06, 22.95, 6.41, -1.26, 6.37, 16.05, -2.44],
      desc: "Títulos que pagam inflação + juro. Oscilam com a marcação a mercado.",
    },
    {
      id: "ibov", nome: "Ações Brasil (Ibovespa)", curto: "Ibovespa", risco: 4,
      hist: [38.9, 26.9, 15.0, 31.6, 2.9, -11.9, 4.7, 22.3, -10.4],
      desc: "Ações da B3, direto ou por ETF (BOVA11, SMAL11).",
    },
    {
      id: "ifix", nome: "Fundos imobiliários (IFIX)", curto: "FIIs", risco: 3,
      hist: [32.3, 19.4, 5.6, 36.0, -10.2, -2.3, 2.2, 15.5, -5.9],
      desc: "Renda de aluguéis e recebíveis imobiliários.",
    },
    {
      id: "sp500", nome: "Exterior (S&P 500 em R$)", curto: "S&P 500", risco: 4,
      hist: emReais(EM_DOLAR.sp500),
      desc: "Ações americanas, via IVVB11, BDRs ou conta no exterior.",
    },
    {
      id: "ouro", nome: "Ouro (em R$)", curto: "Ouro", risco: 3,
      hist: emReais(EM_DOLAR.ouro),
      desc: "Proteção contra crises e desvalorização do real (GOLD11).",
    },
    {
      id: "btc", nome: "Bitcoin (em R$)", curto: "Bitcoin", risco: 5,
      hist: emReais(EM_DOLAR.btc),
      desc: "A maior cripto. Altíssima volatilidade.",
    },
    {
      id: "eth", nome: "Ethereum (em R$)", curto: "Ethereum", risco: 5,
      hist: emReais(EM_DOLAR.eth),
      desc: "Plataforma de contratos inteligentes. Ainda mais volátil que o Bitcoin.",
    },
  ];

  const IPCA = [6.29, 2.95, 3.75, 4.31, 4.52, 10.06, 5.79, 4.62, 4.83];

  // Quedas máximas do topo ao fundo (aprox., em dólar), para contextualizar o risco cripto.
  const QUEDAS_CRIPTO = [
    { ativo: "Bitcoin", periodo: "dez/2017 a dez/2018", queda: -84 },
    { ativo: "Bitcoin", periodo: "nov/2021 a nov/2022", queda: -77 },
    { ativo: "Ethereum", periodo: "jan/2018 a dez/2018", queda: -94 },
    { ativo: "Ethereum", periodo: "nov/2021 a jun/2022", queda: -80 },
  ];

  // Premissas da projeção, em TERMOS REAIS (acima da inflação), por classe:
  // ret = retorno real anual mediano esperado; vol = volatilidade anual;
  // custo = custos anuais (taxa de ETF, custódia, spread); ir = alíquota de IR sobre o ganho nominal no resgate.
  // O retorno real do CDI vem do "juro real de longo prazo" informado na projeção.
  const JURO_REAL_PADRAO = 4.5; // média aproximada do CDI acima do IPCA nas últimas duas décadas
  const INFLACAO_PADRAO = 4.0; // inflação de longo prazo esperada
  const PREMISSAS = {
    cdi: { ret: JURO_REAL_PADRAO, vol: 1.5, custo: 0.1, ir: 15 }, // custódia do Tesouro Selic acima de R$ 10 mil
    ipca: { ret: 5.5, vol: 9, custo: 0.2, ir: 15 }, // custódia B3 do Tesouro
    ibov: { ret: 6.5, vol: 24, custo: 0.2, ir: 15 }, // ETFs (BOVA11 ≈ 0,10%; SMAL11 ≈ 0,50%)
    ifix: { ret: 5.5, vol: 13, custo: 0, ir: 6 }, // rendimentos isentos; IR de 20% só sobre a valorização das cotas
    sp500: { ret: 6, vol: 19, custo: 0.4, ir: 15 }, // ETF (≈ 0,23%) + custo de câmbio
    ouro: { ret: 2.5, vol: 17, custo: 0.3, ir: 15 },
    btc: { ret: 10, vol: 65, custo: 0.8, ir: 15 }, // spread de compra e venda ou taxa de ETF
    eth: { ret: 10, vol: 85, custo: 0.8, ir: 15 },
  };

  // Produtos de renda fixa padrão para o simulador. tipo: "cdi" (% do CDI), "selic" (% da Selic) ou "poupanca".
  // teto: saldo máximo que rende a taxa principal (0 = sem teto); pctAcima: % do CDI sobre o que passar do teto;
  // carencia: meses mínimos antes do resgate.
  const PRODUTOS_RF = [
    { id: "poupanca", nome: "Poupança", tipo: "poupanca", pct: 100, isento: true, teto: 0, pctAcima: 100, carencia: 0, liquidez: "Diária" },
    { id: "selic", nome: "Tesouro Selic", tipo: "selic", pct: 100, isento: false, teto: 0, pctAcima: 100, carencia: 0, liquidez: "D+1" },
    { id: "cdb100", nome: "CDB liquidez diária", tipo: "cdi", pct: 100, isento: false, teto: 0, pctAcima: 100, carencia: 0, liquidez: "Diária" },
    { id: "turbo", nome: "Caixinha Nubank 115% (até R$ 5 mil)", tipo: "cdi", pct: 115, isento: false, teto: 5000, pctAcima: 100, carencia: 0, liquidez: "Diária" },
    { id: "lci", nome: "LCI/LCA", tipo: "cdi", pct: 90, isento: true, teto: 0, pctAcima: 90, carencia: 12, liquidez: "No vencimento" },
  ];

  // Correlações aproximadas entre as classes (em R$). Ordem igual a CLASSES.
  const CORRELACAO = [
    //  cdi   ipca  ibov  ifix  sp500 ouro  btc   eth
    [1.0, 0.1, 0.0, 0.05, -0.05, 0.0, 0.0, 0.0],
    [0.1, 1.0, 0.5, 0.55, -0.2, -0.1, 0.05, 0.05],
    [0.0, 0.5, 1.0, 0.5, -0.1, -0.2, 0.15, 0.15],
    [0.05, 0.55, 0.5, 1.0, -0.1, -0.1, 0.05, 0.05],
    [-0.05, -0.2, -0.1, -0.1, 1.0, 0.3, 0.3, 0.3],
    [0.0, -0.1, -0.2, -0.1, 0.3, 1.0, 0.1, 0.1],
    [0.0, 0.05, 0.15, 0.05, 0.3, 0.1, 1.0, 0.8],
    [0.0, 0.05, 0.15, 0.05, 0.3, 0.1, 0.8, 1.0],
  ];

  // Carteiras modelo por perfil (% por classe). Material educativo, não é recomendação.
  const PERFIS = {
    conservador: {
      nome: "Conservador", risco: 1,
      resumo: "Prioriza segurança e liquidez. Aceita pouca oscilação.",
      alocacao: { cdi: 60, ipca: 25, ibov: 5, ifix: 5, sp500: 5, ouro: 0, btc: 0, eth: 0 },
    },
    moderado: {
      nome: "Moderado", risco: 2,
      resumo: "Base em renda fixa com uma parte em ações, FIIs e exterior.",
      alocacao: { cdi: 35, ipca: 20, ibov: 15, ifix: 10, sp500: 15, ouro: 3, btc: 2, eth: 0 },
    },
    arrojado: {
      nome: "Arrojado", risco: 3,
      resumo: "Busca crescimento e tolera quedas de 20% a 30% no caminho.",
      alocacao: { cdi: 20, ipca: 15, ibov: 20, ifix: 10, sp500: 22, ouro: 5, btc: 6, eth: 2 },
    },
    agressivo: {
      nome: "Agressivo", risco: 4,
      resumo: "Foco no longo prazo, com renda variável e cripto relevantes.",
      alocacao: { cdi: 10, ipca: 10, ibov: 25, ifix: 8, sp500: 27, ouro: 5, btc: 11, eth: 4 },
    },
  };

  // Questionário de perfil: cada opção vale de 1 a 4 pontos.
  const QUESTOES = [
    {
      id: "prazo", texto: "Daqui a quanto tempo você deve precisar desse dinheiro?",
      opcoes: ["Menos de 1 ano", "De 1 a 3 anos", "De 3 a 10 anos", "Mais de 10 anos"],
    },
    {
      id: "queda", texto: "Sua carteira caiu 25% em três meses. O que você faz?",
      opcoes: ["Vendo tudo para não perder mais", "Vendo uma parte", "Mantenho e espero", "Aproveito para comprar mais"],
    },
    {
      id: "objetivo", texto: "Qual é o seu principal objetivo?",
      opcoes: ["Preservar o que tenho", "Gerar renda extra", "Fazer o patrimônio crescer", "Maximizar o retorno no longo prazo"],
    },
    {
      id: "experiencia", texto: "Em que você já investiu?",
      opcoes: ["Só poupança", "Renda fixa (Tesouro, CDB)", "Ações, FIIs ou ETFs", "Cripto, opções ou exterior"],
    },
    {
      id: "reserva", texto: "Como está sua reserva de emergência?",
      opcoes: ["Não tenho", "Tenho uma parte", "Completa (6 meses ou mais)", "Completa e sem dívidas caras"],
    },
    {
      id: "renda", texto: "Quanto da sua renda mensal sobra para investir?",
      opcoes: ["Menos de 5%", "De 5% a 15%", "De 15% a 30%", "Mais de 30%"],
    },
  ];

  // Onde investir: catálogo de instrumentos, com foco em risco médio e alto.
  // Regras de IR para pessoa física conforme a legislação de 2025; mudam com frequência.
  const INSTRUMENTOS = [
    { nome: "Tesouro Selic", classe: "cdi", risco: 1, liquidez: "D+0 / D+1", ir: "Tabela regressiva (22,5% a 15%)", minimo: "≈ R$ 150", para: "Reserva de emergência e caixa para oportunidades.", cuidado: "Rende menos que outras opções no longo prazo." },
    { nome: "CDB, LCI e LCA de bancos médios", classe: "cdi", risco: 2, liquidez: "Diária ou no vencimento", ir: "CDB: tabela regressiva. LCI/LCA: isentas", minimo: "R$ 100 a R$ 1.000", para: "Ganhar mais que o Tesouro Selic com garantia do FGC.", cuidado: "FGC cobre até R$ 250 mil por CPF e instituição. Muitos não têm liquidez diária." },
    { nome: "Tesouro IPCA+ longo (2045 em diante)", classe: "ipca", risco: 3, liquidez: "D+1, mas com marcação a mercado", ir: "Tabela regressiva", minimo: "≈ R$ 40", para: "Aposentadoria e proteção contra a inflação.", cuidado: "Se vender antes do vencimento, pode perder 20% ou mais quando os juros sobem." },
    { nome: "Debêntures incentivadas, CRI e CRA", classe: "ipca", risco: 3, liquidez: "Baixa (mercado secundário)", ir: "Isentas para pessoa física", minimo: "R$ 1.000", para: "Taxas acima do Tesouro, sem IR.", cuidado: "Sem FGC: se a empresa quebrar, você pode perder. Analise o emissor e a nota de crédito." },
    { nome: "Fundos imobiliários (FIIs)", classe: "ifix", risco: 3, liquidez: "D+2 (bolsa)", ir: "Rendimentos mensais isentos (com condições). Venda com lucro: 20%", minimo: "≈ R$ 10 por cota", para: "Renda mensal de aluguéis e recebíveis.", cuidado: "As cotas oscilam com os juros. Fundos de papel têm risco de crédito." },
    { nome: "Fiagro", classe: "ifix", risco: 3, liquidez: "D+2 (bolsa)", ir: "Rendimentos isentos (com condições)", minimo: "≈ R$ 10 por cota", para: "Renda ligada ao agronegócio.", cuidado: "Setor exposto a clima, safra e preço de commodities." },
    { nome: "Ações brasileiras", classe: "ibov", risco: 4, liquidez: "D+2 (bolsa)", ir: "15% sobre o lucro. Vendas até R$ 20 mil/mês isentas", minimo: "Preço de 1 ação", para: "Ser sócio de empresas e receber dividendos.", cuidado: "Uma ação sozinha pode cair 50% ou mais. Diversifique ou use ETFs." },
    { nome: "ETFs brasileiros (BOVA11, SMAL11, DIVO11)", classe: "ibov", risco: 4, liquidez: "D+2 (bolsa)", ir: "15% sobre o lucro, sem isenção", minimo: "≈ R$ 100", para: "Comprar dezenas de ações de uma vez, com taxa baixa.", cuidado: "Segue o índice: quando a bolsa cai, cai junto." },
    { nome: "ETFs internacionais na B3 (IVVB11, WRLD11, NASD11)", classe: "sp500", risco: 4, liquidez: "D+2 (bolsa)", ir: "15% sobre o lucro", minimo: "≈ R$ 100 a R$ 400", para: "Exposição ao exterior e ao dólar sem abrir conta fora.", cuidado: "Variam com a bolsa americana e com o câmbio ao mesmo tempo." },
    { nome: "BDRs", classe: "sp500", risco: 4, liquidez: "D+2 (bolsa)", ir: "15% sobre o lucro, sem isenção. Dividendos tributados", minimo: "Preço de 1 BDR", para: "Ações de empresas estrangeiras (Apple, Nvidia) pela B3.", cuidado: "Liquidez menor em BDRs pouco negociados." },
    { nome: "Conta em corretora no exterior", classe: "sp500", risco: 4, liquidez: "D+1 a D+3, mais câmbio", ir: "15% ao ano sobre rendimentos (Lei 14.754/2023)", minimo: "≈ US$ 1", para: "ETFs globais (VT, VOO) e dolarização do patrimônio.", cuidado: "Custo de câmbio (spread e IOF) e declaração anual obrigatória." },
    { nome: "Ouro (GOLD11)", classe: "ouro", risco: 3, liquidez: "D+2 (bolsa)", ir: "15% sobre o lucro", minimo: "≈ R$ 15", para: "Proteção em crises e diversificação.", cuidado: "Não paga juros nem dividendos. Pode passar anos parado." },
    { nome: "Bitcoin direto em exchange", classe: "btc", risco: 5, liquidez: "Imediata (24h por dia)", ir: "Vendas até R$ 35 mil/mês isentas. Acima: 15% a 22,5%", minimo: "≈ R$ 10", para: "Reserva de valor de longo prazo, com parcela pequena da carteira.", cuidado: "Já caiu mais de 75% duas vezes. Use autenticação em dois fatores e considere autocustódia." },
    { nome: "ETFs de cripto na B3 (QBTC11, BITH11, HASH11)", classe: "btc", risco: 5, liquidez: "D+2 (bolsa)", ir: "15% sobre o lucro, sem isenção", minimo: "≈ R$ 10 a R$ 50", para: "Cripto pela corretora de sempre, sem cuidar de carteira digital.", cuidado: "Taxa de administração e mesma volatilidade da cripto." },
    { nome: "Ethereum e outras criptos", classe: "eth", risco: 5, liquidez: "Imediata (24h por dia)", ir: "Mesma regra do Bitcoin", minimo: "≈ R$ 10", para: "Apostar no crescimento de plataformas de contratos inteligentes.", cuidado: "A maioria das altcoins perdeu quase todo o valor. Ethereum já caiu 94%." },
    { nome: "Stablecoins (USDT, USDC)", classe: "sp500", risco: 3, liquidez: "Imediata", ir: "Regra das criptos", minimo: "≈ R$ 10", para: "Guardar valor em dólar dentro do mundo cripto.", cuidado: "Depende da solidez do emissor e da exchange. Não tem FGC." },
    { nome: "Staking e DeFi", classe: "eth", risco: 5, liquidez: "Variável, às vezes com bloqueio", ir: "Rendimentos tributáveis como ganho de cripto", minimo: "Variável", para: "Gerar renda com as criptos que você já tem.", cuidado: "Falhas em contratos inteligentes e quebras de plataformas já apagaram bilhões." },
    { nome: "Fundos multimercado", classe: "ibov", risco: 3, liquidez: "D+1 a D+60", ir: "Tabela regressiva com come-cotas semestral", minimo: "R$ 100 a R$ 5.000", para: "Deixar um gestor combinar juros, bolsa e câmbio.", cuidado: "Taxas altas (até 2% + performance). Muitos perdem para o CDI." },
    { nome: "Opções (venda coberta, travas)", classe: "ibov", risco: 5, liquidez: "D+1 (bolsa)", ir: "15% (20% em day trade), sem isenção", minimo: "Lote de opções", para: "Investidores experientes que querem renda extra ou proteção.", cuidado: "Exige estudo. Operações a descoberto podem dar perdas maiores que o investido." },
    { nome: "Day trade e alavancagem", classe: "ibov", risco: 5, liquidez: "Imediata", ir: "20% sobre o lucro", minimo: "Margem na corretora", para: "Quase ninguém. Estudo da FGV (2019) mostrou que 97% dos que insistiram por mais de 300 dias perderam dinheiro.", cuidado: "Alavancagem pode zerar a conta e gerar dívida." },
  ];

  const Dados = { ANOS, DOLAR, IPCA, CLASSES, QUEDAS_CRIPTO, PREMISSAS, JURO_REAL_PADRAO, INFLACAO_PADRAO, PRODUTOS_RF, CORRELACAO, PERFIS, QUESTOES, INSTRUMENTOS };
  if (typeof module !== "undefined" && module.exports) module.exports = Dados;
  else root.Dados = Dados;
})(typeof window !== "undefined" ? window : globalThis);
