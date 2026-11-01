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

  // Produtos de renda fixa padrão para o simulador.
  // tipo: "cdi" (% do CDI), "selic" (% da Selic), "poupanca", "prefixado" (% ao ano) ou "ipca" (IPCA + % ao ano).
  // teto: saldo máximo que rende a taxa principal (0 = sem teto); pctAcima: % do CDI sobre o que passar do teto;
  // carencia: meses mínimos antes do resgate (nos títulos do Tesouro, meses até o vencimento);
  // plataforma: id em PLATAFORMAS ("" = qualquer banco ou corretora); emissor: quem deve o dinheiro (para o FGC);
  // custodia: custo anual em % (ex.: 0,20% da B3 nos títulos do Tesouro).
  const PRODUTOS_RF = [
    { id: "poupanca", nome: "Poupança", tipo: "poupanca", pct: 100, isento: true, teto: 0, pctAcima: 100, carencia: 0, plataforma: "", emissor: "", custodia: 0 },
    { id: "selic", nome: "Tesouro Selic", tipo: "selic", pct: 100, isento: false, teto: 0, pctAcima: 100, carencia: 0, plataforma: "", emissor: "Tesouro Nacional", custodia: 0 },
    { id: "cdb100", nome: "CDB liquidez diária", tipo: "cdi", pct: 100, isento: false, teto: 0, pctAcima: 100, carencia: 0, plataforma: "", emissor: "", custodia: 0 },
    { id: "turbo", nome: "Caixinha Nubank 115% (até R$ 5 mil)", tipo: "cdi", pct: 115, isento: false, teto: 5000, pctAcima: 100, carencia: 0, plataforma: "nubank", emissor: "Nu Financeira", custodia: 0 },
    { id: "lci", nome: "LCI/LCA", tipo: "cdi", pct: 90, isento: true, teto: 0, pctAcima: 90, carencia: 12, plataforma: "", emissor: "", custodia: 0 },
  ];

  const TESOURO_EMISSOR = "Tesouro Nacional"; // títulos públicos: garantia do governo, fora do FGC
  const FGC_LIMITE = 250000; // por CPF, por instituição (conglomerado)
  const IOF_CAMBIO = 1.1; // remessa para conta própria de investimento no exterior; confira a regra vigente
  const TAXA_B3 = 0.03; // emolumentos e liquidação da B3 por operação em ações, ETFs e FIIs (aprox.)

  // O que cada app oferece. Chaves usadas em PLATAFORMAS[].oferece.
  const OFERTAS = {
    reserva: "Caixinha ou conta que rende",
    cdb: "CDB",
    lci: "LCI/LCA",
    tesouro: "Tesouro Direto",
    acoes: "Ações",
    etfs: "ETFs",
    fiis: "FIIs",
    bdrs: "BDRs",
    fundos: "Fundos",
    cripto: "Cripto",
    exterior: "Conta no exterior",
  };

  // Apps, bancos e corretoras. Custos de REFERÊNCIA (2025), da memória de quem montou o app:
  // mudam com frequência e devem ser conferidos no app. Todos são editáveis na tela.
  // corretagem: R$ por ordem de ações/ETFs/FIIs; custodia: % a.a. sobre ações; cripto: custo % por operação
  // (taxa ou spread); cambio: spread % na conversão para dólar. null = não oferece ou sem referência.
  const PLATAFORMAS = [
    { id: "nubank", nome: "Nubank", tipo: "banco", oferece: ["reserva", "cdb", "tesouro", "acoes", "etfs", "fiis", "bdrs", "fundos", "cripto"],
      custos: { corretagem: 0, custodia: 0, cripto: 2, cambio: null },
      destaque: "Caixinhas com liquidez diária e investimentos (pela NuInvest) no mesmo app da conta.",
      cuidado: "Cripto comprada no app tem o custo embutido no preço, em geral maior que o de uma exchange." },
    { id: "inter", nome: "Inter", tipo: "banco", oferece: ["reserva", "cdb", "lci", "tesouro", "acoes", "etfs", "fiis", "bdrs", "fundos", "cripto", "exterior"],
      custos: { corretagem: 0, custodia: 0, cripto: 1.5, cambio: 1 },
      destaque: "Prateleira ampla no app do banco, com LCI/LCA, bolsa e conta em dólar (Inter Global).",
      cuidado: "Compare o CDB do próprio Inter com os de outros emissores oferecidos no app." },
    { id: "c6", nome: "C6 Bank", tipo: "banco", oferece: ["reserva", "cdb", "tesouro", "acoes", "etfs", "fiis", "exterior"],
      custos: { corretagem: 0, custodia: 0, cripto: null, cambio: 1.5 },
      destaque: "CDBs do próprio banco e conta global em dólar no mesmo app.",
      cuidado: "Confira a liquidez de cada CDB: nem todos permitem resgate diário." },
    { id: "picpay", nome: "PicPay", tipo: "banco", oferece: ["reserva", "cdb", "cripto"],
      custos: { corretagem: null, custodia: null, cripto: 2, cambio: null },
      destaque: "Cofrinhos que rendem com liquidez diária, simples para começar.",
      cuidado: "Poucas opções além da renda fixa do próprio banco." },
    { id: "mercadopago", nome: "Mercado Pago", tipo: "banco", oferece: ["reserva", "cripto"],
      custos: { corretagem: null, custodia: null, cripto: 2, cambio: null },
      destaque: "Saldo e cofrinhos que rendem automaticamente, com liquidez diária.",
      cuidado: "Oferta de investimentos limitada; para diversificar, use também uma corretora." },
    { id: "xp", nome: "XP Investimentos", tipo: "corretora", oferece: ["cdb", "lci", "tesouro", "acoes", "etfs", "fiis", "bdrs", "fundos", "cripto", "exterior"],
      custos: { corretagem: 0, custodia: 0, cripto: 0.5, cambio: 1 },
      destaque: "Uma das maiores prateleiras de CDB, LCI/LCA, crédito privado e fundos do país.",
      cuidado: "Assessores podem sugerir produtos com custo alto (fundos caros, COE). Compare antes de aceitar." },
    { id: "rico", nome: "Rico", tipo: "corretora", oferece: ["cdb", "lci", "tesouro", "acoes", "etfs", "fiis", "bdrs", "fundos"],
      custos: { corretagem: 0, custodia: 0, cripto: null, cambio: null },
      destaque: "Do grupo XP, com prateleira parecida e foco em quem investe sozinho.",
      cuidado: "Ordens por telefone ou com assessoria podem ter custo." },
    { id: "clear", nome: "Clear", tipo: "corretora", oferece: ["tesouro", "acoes", "etfs", "fiis", "bdrs"],
      custos: { corretagem: 0, custodia: 0, cripto: null, cambio: null },
      destaque: "Foco em bolsa, com plataformas para quem compra e vende com frequência.",
      cuidado: "Ferramentas de day trade e alavancagem aumentam muito o risco de perda." },
    { id: "btg", nome: "BTG Pactual", tipo: "corretora", oferece: ["cdb", "lci", "tesouro", "acoes", "etfs", "fiis", "bdrs", "fundos", "cripto", "exterior"],
      custos: { corretagem: 0, custodia: 0, cripto: 0.5, cambio: 1 },
      destaque: "Banco de investimento com boa oferta de renda fixa, crédito privado e cripto (Mynt).",
      cuidado: "Em CDBs de bancos menores, confira o emissor e o limite do FGC." },
    { id: "binance", nome: "Binance", tipo: "cripto", oferece: ["cripto"],
      custos: { corretagem: null, custodia: null, cripto: 0.1, cambio: null },
      destaque: "Maior exchange do mundo, com muitas moedas e taxa de negociação baixa.",
      cuidado: "A taxa baixa vale no livro de ofertas; na compra rápida (conversão) o custo embutido é maior." },
    { id: "mercadobitcoin", nome: "Mercado Bitcoin", tipo: "cripto", oferece: ["cripto"],
      custos: { corretagem: null, custodia: null, cripto: 0.7, cambio: null },
      destaque: "Exchange brasileira antiga, com depósito por Pix e atendimento no Brasil.",
      cuidado: "Taxa por operação maior que a das exchanges globais." },
    { id: "foxbit", nome: "Foxbit", tipo: "cripto", oferece: ["cripto"],
      custos: { corretagem: null, custodia: null, cripto: 0.5, cambio: null },
      destaque: "Exchange brasileira com depósito por Pix.",
      cuidado: "Menos moedas que as exchanges globais." },
    { id: "avenue", nome: "Avenue", tipo: "exterior", oferece: ["exterior"],
      custos: { corretagem: null, custodia: null, cripto: null, cambio: 1 },
      destaque: "Corretora americana (grupo Itaú) para ações e ETFs dos EUA, com app em português.",
      cuidado: "Investimento no exterior paga 15% de IR ao ano sobre os rendimentos (Lei 14.754/2023)." },
    { id: "nomad", nome: "Nomad", tipo: "exterior", oferece: ["exterior"],
      custos: { corretagem: null, custodia: null, cripto: null, cambio: 1.5 },
      destaque: "Conta em dólar com cartão e investimentos nos EUA no mesmo app.",
      cuidado: "Investimento no exterior paga 15% de IR ao ano sobre os rendimentos e exige declaração." },
  ];

  const TIPOS_PLATAFORMA = { banco: "Banco digital", corretora: "Corretora", cripto: "Cripto", exterior: "Exterior" };

  // ETFs amplos para quem está começando na bolsa. Taxa de administração anual aproximada.
  // Não são recomendação: são índices diversificados, citados como ponto de partida.
  const ETFS_INICIO = [
    { ticker: "BOVA11", indice: "Ibovespa: as maiores empresas da B3", taxa: 0.1 },
    { ticker: "SMAL11", indice: "Small caps: empresas menores da B3", taxa: 0.5 },
    { ticker: "DIVO11", indice: "Empresas que mais pagam dividendos (IDIV)", taxa: 0.5 },
    { ticker: "IVVB11", indice: "S&P 500: 500 maiores empresas dos EUA, em reais", taxa: 0.23 },
    { ticker: "WRLD11", indice: "Ações do mundo todo, em reais", taxa: 0.3 },
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
    { nome: "Jogos play-to-earn e tokens pequenos", classe: "eth", risco: 5, liquidez: "Depende de haver compradores", ir: "Regra das criptos", minimo: "Compra de personagens ou NFTs", para: "Só como lazer, com dinheiro que você aceita perder inteiro.", cuidado: "O ganho depende de novos jogadores comprarem. Tokens de jogos como Axie Infinity e Bombcrypto caíram mais de 95% depois do auge." },
    { nome: "Stablecoins (USDT, USDC)", classe: "sp500", risco: 3, liquidez: "Imediata", ir: "Regra das criptos", minimo: "≈ R$ 10", para: "Guardar valor em dólar dentro do mundo cripto.", cuidado: "Depende da solidez do emissor e da exchange. Não tem FGC." },
    { nome: "Staking e DeFi", classe: "eth", risco: 5, liquidez: "Variável, às vezes com bloqueio", ir: "Rendimentos tributáveis como ganho de cripto", minimo: "Variável", para: "Gerar renda com as criptos que você já tem.", cuidado: "Falhas em contratos inteligentes e quebras de plataformas já apagaram bilhões." },
    { nome: "Fundos multimercado", classe: "ibov", risco: 3, liquidez: "D+1 a D+60", ir: "Tabela regressiva com come-cotas semestral", minimo: "R$ 100 a R$ 5.000", para: "Deixar um gestor combinar juros, bolsa e câmbio.", cuidado: "Taxas altas (até 2% + performance). Muitos perdem para o CDI." },
    { nome: "Opções (venda coberta, travas)", classe: "ibov", risco: 5, liquidez: "D+1 (bolsa)", ir: "15% (20% em day trade), sem isenção", minimo: "Lote de opções", para: "Investidores experientes que querem renda extra ou proteção.", cuidado: "Exige estudo. Operações a descoberto podem dar perdas maiores que o investido." },
    { nome: "Day trade e alavancagem", classe: "ibov", risco: 5, liquidez: "Imediata", ir: "20% sobre o lucro", minimo: "Margem na corretora", para: "Quase ninguém. Estudo da FGV (2019) mostrou que 97% dos que insistiram por mais de 300 dias perderam dinheiro.", cuidado: "Alavancagem pode zerar a conta e gerar dívida." },
  ];

  // ---------- Manual ----------

  // Glossário: usado no manual e nos botões "?" espalhados pelo app.
  const GLOSSARIO = {
    aporte: { termo: "Aporte", def: "Dinheiro novo que você coloca nos investimentos, por exemplo todo mês." },
    carencia: { termo: "Carência", def: "Prazo mínimo antes de poder resgatar. LCI e LCA, por exemplo, têm carência de 9 a 12 meses." },
    cdi: { termo: "CDI", def: "Taxa que os bancos cobram para emprestar dinheiro entre si por um dia. Fica sempre muito perto da Selic e é a referência da renda fixa: \"100% do CDI\" quer dizer que o investimento rende o mesmo que essa taxa." },
    comeCotas: { termo: "Come-cotas", def: "Antecipação do IR que os fundos de investimento cobram em maio e novembro, reduzindo o número de cotas. Não existe em ações, ETFs nem FIIs." },
    corretagem: { termo: "Corretagem", def: "Taxa que a corretora cobra por ordem de compra ou venda de ações. Na maioria dos apps, hoje ela é zero." },
    custodia: { termo: "Custódia", def: "Taxa cobrada para guardar seus títulos ou ações. No Tesouro Direto, a B3 cobra 0,20% ao ano; o Tesouro Selic é isento até R$ 10 mil." },
    dividendos: { termo: "Dividendos", def: "Parte do lucro que a empresa divide com os acionistas, em dinheiro na conta. Para a maioria dos investidores pessoa física, são isentos de IR." },
    dividendYield: { termo: "Dividend yield", def: "Quanto uma ação ou um FII pagou em 12 meses, dividido pelo preço. Um yield de 6% significa R$ 6 por ano para cada R$ 100 investidos." },
    emissor: { termo: "Emissor", def: "Quem pegou o seu dinheiro emprestado e vai devolver: o banco no CDB, o governo no Tesouro, a empresa na debênture. O limite do FGC vale por emissor." },
    etf: { termo: "ETF", def: "Fundo negociado na bolsa que copia um índice, como o Ibovespa. Comprar uma cota é como comprar dezenas de empresas de uma vez." },
    fgc: { termo: "FGC", def: "Fundo Garantidor de Créditos. Se um banco quebrar, devolve até R$ 250 mil por CPF em cada instituição, já com os juros. Cobre CDB, LCI, LCA e poupança. Não cobre Tesouro (garantido pelo governo), ações, fundos nem cripto." },
    iof: { termo: "IOF", def: "Imposto sobre operações financeiras. Na renda fixa, só existe em resgates com menos de 30 dias. No câmbio, incide na conversão de reais para dólar." },
    ipca: { termo: "IPCA", def: "Índice oficial de inflação do Brasil, medido pelo IBGE. Mostra quanto os preços subiram. Se o seu dinheiro rende menos que o IPCA, você perde poder de compra." },
    ir: { termo: "IR regressivo", def: "Imposto de renda da renda fixa, que diminui com o tempo: 22,5% até 6 meses, 20% até 1 ano, 17,5% até 2 anos e 15% depois disso. Incide só sobre o lucro, no resgate." },
    isento: { termo: "Isento de IR", def: "Não paga imposto de renda sobre o lucro. É o caso de LCI, LCA, poupança, debêntures incentivadas e dos rendimentos mensais dos FIIs (com condições)." },
    jurosCompostos: { termo: "Juros compostos", def: "Juros sobre juros: o rendimento de cada mês passa a render também nos meses seguintes. É o que faz o dinheiro crescer cada vez mais rápido com o tempo." },
    juroReal: { termo: "Juro real", def: "Quanto um investimento rende acima da inflação. Se rende 12% e a inflação foi de 4%, o juro real é de cerca de 7,7%." },
    liquidez: { termo: "Liquidez", def: "Facilidade de transformar o investimento em dinheiro na conta. Liquidez diária quer dizer que você pode resgatar em qualquer dia." },
    marcacao: { termo: "Marcação a mercado", def: "O preço de títulos como o Tesouro Prefixado e o IPCA+ muda todo dia, conforme os juros do mercado. Se vender antes do vencimento, você pode ganhar mais ou perder. Se ficar até o vencimento, recebe exatamente a taxa contratada." },
    mediana: { termo: "Cenário mediano", def: "O resultado do meio: metade dos cenários simulados termina acima dele e metade termina abaixo." },
    montecarlo: { termo: "Monte Carlo", def: "Técnica que simula milhares de futuros possíveis sorteando retornos. Em vez de um número só, mostra a faixa de resultados prováveis." },
    posfixado: { termo: "Pós-fixado", def: "Investimento que acompanha um índice, como o CDI ou a Selic. Você só sabe quanto rendeu depois, porque o índice muda." },
    prefixado: { termo: "Prefixado", def: "Investimento com a taxa definida na compra, por exemplo 13% ao ano. Se ficar até o vencimento, você sabe exatamente quanto vai receber." },
    rebalancear: { termo: "Rebalancear", def: "Trazer a carteira de volta às porcentagens planejadas, colocando os novos aportes no que ficou abaixo do alvo." },
    selic: { termo: "Selic", def: "Taxa básica de juros do Brasil, definida pelo Banco Central a cada 45 dias. Quando ela sobe, a renda fixa rende mais; quando cai, rende menos." },
    spread: { termo: "Spread", def: "Diferença entre a cotação real e o preço que o app cobra. É um custo embutido, comum no câmbio e em cripto." },
    teto: { termo: "Teto", def: "Valor máximo que rende a taxa anunciada. Na caixinha de 115% do CDI até R$ 5 mil, o que passar de R$ 5 mil rende uma taxa menor." },
    vencimento: { termo: "Vencimento", def: "Data em que o título termina e o dinheiro, com os juros, volta para a sua conta." },
    volatilidade: { termo: "Volatilidade", def: "Quanto o preço de um investimento sobe e desce. Volatilidade de 25% ao ano quer dizer que, num ano comum, o valor pode variar cerca de 25% para cima ou para baixo." },
  };

  // As 4 formas de o dinheiro voltar para você.
  const MANUAL_MECANISMOS = [
    { id: "juros", nome: "Juros", titulo: "Você empresta e recebe de volta com juros",
      texto: "Na renda fixa, você empresta dinheiro para um banco, para o governo ou para uma empresa. Eles devolvem o valor com um acréscimo combinado: os juros.",
      exemplos: "CDB, LCI/LCA, Tesouro Direto, poupança, debêntures" },
    { id: "dividendos", nome: "Dividendos", titulo: "Você vira sócio e recebe parte do lucro",
      texto: "Ao comprar uma ação, você vira dono de um pedacinho da empresa. Quando ela lucra, pode dividir parte do lucro com os sócios, em dinheiro na sua conta.",
      exemplos: "Ações de empresas que pagam dividendos" },
    { id: "alugueis", nome: "Aluguéis", titulo: "Você vira dono de imóveis e recebe aluguel",
      texto: "Nos fundos imobiliários, você compra cotas de um fundo dono de prédios, galpões ou shoppings. Os aluguéis pagos pelos inquilinos são divididos entre os cotistas, em geral todo mês.",
      exemplos: "Fundos imobiliários (FIIs) e Fiagro" },
    { id: "valorizacao", nome: "Valorização", titulo: "O preço sobe e você vende mais caro",
      texto: "Ações, ETFs, ouro e cripto podem valer mais no futuro. O ganho só vira dinheiro quando você vende. O preço também pode cair, e aí você perde.",
      exemplos: "Ações, ETFs, BDRs, ouro, Bitcoin" },
  ];

  // Cada investimento explicado. exemplo.tipo diz como o app calcula o exemplo com R$ 1.000:
  // "rf" (renda fixa com as taxas atuais), "tesouro" (taxa oficial do dia), "fii", "acoes", "etf", "exterior",
  // "historico" (melhor e pior ano de 2016 a 2024) e "fundo".
  const MANUAL_INVESTIMENTOS = [
    { id: "poupanca", nome: "Poupança", mecanismo: "juros", rota: "renda-fixa",
      frase: "Uma conta que rende um pouco todo mês, sem imposto.",
      comoGanha: "O banco usa o seu dinheiro para fazer empréstimos e paga a você 0,5% ao mês mais a TR, quando a Selic está acima de 8,5% ao ano.",
      quando: "Uma vez por mês, no aniversário do depósito. Se sacar antes, perde o rendimento daquele mês.",
      riscos: "Muito baixo, com garantia do FGC. O risco real é render menos que a inflação.",
      imposto: "Isenta.",
      exemplo: { tipo: "rf", prod: { tipo: "poupanca", pct: 100, isento: true } } },
    { id: "selic", nome: "Tesouro Selic", mecanismo: "juros", rota: "renda-fixa",
      frase: "Você empresta para o governo e recebe a taxa Selic.",
      comoGanha: "O título acompanha a Selic todos os dias. É o investimento mais seguro do país e o preferido para a reserva de emergência.",
      quando: "Os juros se acumulam todo dia e você recebe tudo quando vender, o que pode fazer em qualquer dia útil.",
      riscos: "Muito baixo: garantia do governo federal. O preço quase não oscila.",
      imposto: "IR regressivo sobre o lucro (22,5% a 15%). Custódia da B3 isenta até R$ 10 mil.",
      exemplo: { tipo: "rf", prod: { tipo: "selic", pct: 100 } } },
    { id: "cdb", nome: "CDB", mecanismo: "juros", rota: "apps",
      frase: "Você empresta para um banco e recebe juros.",
      comoGanha: "O banco usa o dinheiro para emprestar a clientes cobrando juros maiores e repassa uma parte a você, em geral uma porcentagem do CDI, como 100% ou 110%.",
      quando: "No vencimento, ou quando você resgatar, se o CDB tiver liquidez diária.",
      riscos: "Baixo até R$ 250 mil por banco, por causa do FGC. Bancos menores pagam mais porque têm mais risco.",
      imposto: "IR regressivo sobre o lucro (22,5% a 15%).",
      exemplo: { tipo: "rf", prod: { tipo: "cdi", pct: 100 } } },
    { id: "lci", nome: "LCI e LCA", mecanismo: "juros", rota: "renda-fixa",
      frase: "Você empresta para um banco financiar imóveis ou o agronegócio, sem pagar IR.",
      comoGanha: "Funciona como um CDB, mas o dinheiro vai para crédito imobiliário (LCI) ou do agronegócio (LCA). Por ser isenta, uma LCI de 90% do CDI pode render mais que um CDB de 105%.",
      quando: "No vencimento. Há carência de 9 a 12 meses antes de poder resgatar.",
      riscos: "Baixo, com FGC até R$ 250 mil por banco. O dinheiro fica preso durante a carência.",
      imposto: "Isenta para pessoa física.",
      exemplo: { tipo: "rf", prod: { tipo: "cdi", pct: 90, isento: true } } },
    { id: "prefixado", nome: "Tesouro Prefixado", mecanismo: "juros", rota: "apps",
      frase: "Você empresta para o governo com a taxa travada no dia da compra.",
      comoGanha: "Você compra o título hoje por um preço menor e recebe R$ 1.000 por título no vencimento. A diferença são os juros, definidos na compra.",
      quando: "No vencimento. Se vender antes, recebe o preço do dia, que pode estar acima ou abaixo.",
      riscos: "Baixo risco de calote. Se os juros subirem e você vender antes, pode perder (marcação a mercado).",
      imposto: "IR regressivo sobre o lucro. Custódia da B3 de 0,20% ao ano.",
      exemplo: { tipo: "tesouro", familia: "prefixado", prazoRef: 36, padrao: 13 } },
    { id: "ipca", nome: "Tesouro IPCA+", mecanismo: "juros", rota: "apps",
      frase: "Você empresta para o governo e recebe a inflação mais uma taxa fixa.",
      comoGanha: "O valor é corrigido pelo IPCA e ainda ganha uma taxa extra, como IPCA + 7%. Seu poder de compra fica protegido e cresce.",
      quando: "No vencimento. Antes disso vale o preço do dia, que oscila bastante nos títulos longos.",
      riscos: "Baixo risco de calote. Oscilação forte de preço se vender antes do vencimento.",
      imposto: "IR regressivo sobre o lucro, inclusive sobre a parte que só repõe a inflação. Custódia de 0,20% ao ano.",
      exemplo: { tipo: "tesouro", familia: "ipca", prazoRef: 120, padrao: 7 } },
    { id: "debentures", nome: "Debêntures, CRI e CRA", mecanismo: "juros", rota: "onde-investir",
      frase: "Você empresta direto para uma empresa.",
      comoGanha: "Empresas emitem debêntures (e CRIs e CRAs, ligados a imóveis e ao agro) para financiar projetos e pagam juros, em geral acima do Tesouro. As incentivadas são isentas de IR.",
      quando: "Juros periódicos (semestrais ou anuais) ou tudo no vencimento, conforme o título.",
      riscos: "Médio: não tem FGC. Se a empresa quebrar, você pode perder. É difícil vender antes do vencimento.",
      imposto: "Debêntures incentivadas, CRI e CRA: isentos. Debêntures comuns: IR regressivo.",
      exemplo: { tipo: "rf", prod: { tipo: "ipca", pct: 7.5, isento: true }, hipotetico: true } },
    { id: "fiis", nome: "Fundos imobiliários (FIIs)", mecanismo: "alugueis", rota: "onde-investir",
      frase: "Você vira dono de um pedaço de imóveis e recebe aluguel todo mês.",
      comoGanha: "O fundo compra prédios, galpões, shoppings ou títulos imobiliários. Os aluguéis e juros recebidos são divididos entre os cotistas. A cota também sobe e desce na bolsa.",
      quando: "Em geral todo mês, direto na conta da corretora.",
      riscos: "Médio: a cota oscila com os juros e com imóveis vazios. Fundos de papel têm risco de crédito.",
      imposto: "Rendimentos mensais isentos (com condições). Lucro na venda das cotas: 20%.",
      exemplo: { tipo: "fii" } },
    { id: "acoes", nome: "Ações", mecanismo: "dividendos", rota: "apps",
      frase: "Você vira sócio de uma empresa.",
      comoGanha: "Você ganha de dois jeitos: quando a empresa divide o lucro (dividendos e juros sobre capital próprio) e quando a ação se valoriza e você vende mais caro.",
      quando: "Dividendos: quando a empresa decide pagar, de uma a várias vezes por ano. Valorização: só quando você vende.",
      riscos: "Alto: uma ação sozinha pode cair 50% ou mais. Diversifique ou use ETFs.",
      imposto: "Dividendos isentos para a maioria dos investidores. Juros sobre capital próprio: 15% na fonte. Venda com lucro: 15%, com isenção para vendas de até R$ 20 mil por mês.",
      exemplo: { tipo: "acoes" } },
    { id: "etfs", nome: "ETFs", mecanismo: "valorizacao", rota: "apps",
      frase: "Você compra dezenas de empresas de uma vez.",
      comoGanha: "O ETF copia um índice, como o Ibovespa (BOVA11) ou o S&P 500 (IVVB11). Se o índice sobe, a cota sobe junto. Você ganha quando vende mais caro do que comprou.",
      quando: "Quando você vende. A maioria dos ETFs brasileiros reinveste os dividendos na própria cota.",
      riscos: "Alto, mas menor que o de uma ação sozinha, porque é diversificado.",
      imposto: "15% sobre o lucro na venda, sem a isenção de R$ 20 mil por mês.",
      exemplo: { tipo: "etf" } },
    { id: "exterior", nome: "Exterior (BDRs, IVVB11, conta lá fora)", mecanismo: "valorizacao", rota: "apps",
      frase: "Você investe em empresas de outros países, em dólar.",
      comoGanha: "O retorno vem de duas fontes: a valorização das empresas lá fora e a alta do dólar. Se o dólar sobe, o investimento em reais sobe junto.",
      quando: "Quando você vende. Algumas ações pagam dividendos em dólar.",
      riscos: "Alto: oscila com a bolsa americana e com o câmbio.",
      imposto: "Pela B3 (IVVB11, BDRs): 15% sobre o lucro. Conta no exterior: 15% ao ano sobre os rendimentos (Lei 14.754/2023).",
      exemplo: { tipo: "exterior" } },
    { id: "ouro", nome: "Ouro", mecanismo: "valorizacao", rota: "onde-investir",
      frase: "Você guarda um metal que costuma subir em crises.",
      comoGanha: "O ouro não paga juros nem dividendos. Você só ganha se o preço subir, o que costuma acontecer em crises e quando o dólar sobe.",
      quando: "Só quando você vende.",
      riscos: "Médio: pode passar anos parado ou caindo.",
      imposto: "GOLD11: 15% sobre o lucro na venda.",
      exemplo: { tipo: "historico", classe: "ouro" } },
    { id: "bitcoin", nome: "Bitcoin e criptomoedas", mecanismo: "valorizacao", rota: "cripto",
      frase: "Você compra uma moeda digital com quantidade limitada.",
      comoGanha: "O Bitcoin não paga renda. O ganho vem só da valorização: se mais gente quiser comprar, o preço sobe. O caminho tem quedas muito fortes.",
      quando: "Só quando você vende.",
      riscos: "Muito alto: já caiu mais de 75% duas vezes. Golpes e invasões de corretoras também acontecem.",
      imposto: "Vendas de até R$ 35 mil por mês isentas; acima disso, 15% a 22,5% sobre o lucro. ETFs na B3: 15%.",
      exemplo: { tipo: "historico", classe: "btc" } },
    { id: "fundos", nome: "Fundos de investimento", mecanismo: "valorizacao", rota: "onde-investir",
      frase: "Um gestor profissional investe por você.",
      comoGanha: "Você compra cotas e o gestor aplica em juros, ações, câmbio e outros ativos. Se o fundo ganha, a cota sobe. Em troca, ele cobra taxas.",
      quando: "Quando você resgata, com prazo de 1 a 60 dias para o dinheiro cair na conta.",
      riscos: "Depende do fundo. Taxas altas comem boa parte do retorno, e muitos fundos perdem para o CDI.",
      imposto: "IR regressivo, com come-cotas em maio e novembro.",
      exemplo: { tipo: "fundo" } },
  ];

  // Guia das abas do hub.
  const GUIA_ABAS = [
    { rota: "visao", nome: "Visão geral", paraQue: "Mostra o resumo do seu perfil e da sua carteira e compara o risco e o retorno de cada tipo de investimento.",
      passos: ["Siga o \"Comece por aqui\" para montar o seu plano.", "Use o mapa de risco × retorno para comparar as classes.", "Veja na tabela quanto cada classe rendeu de 2016 a 2024."],
      dica: "Use \"Copiar meus dados\", no fim da página, para levar tudo para outro aparelho." },
    { rota: "perfil", nome: "Meu perfil", paraQue: "Descobre quanto risco faz sentido para você e sugere uma carteira modelo.",
      passos: ["Responda as 6 perguntas.", "Veja o seu perfil e a carteira modelo.", "Clique em \"Projetar esta carteira\"."],
      dica: "Refaça quando a sua vida mudar: novo emprego, filho, compra de imóvel." },
    { rota: "projecao", nome: "Projeção", paraQue: "Simula milhares de futuros possíveis para o seu dinheiro, em reais de hoje, já descontando custos e imposto.",
      passos: ["Informe o valor inicial, o aporte mensal e o prazo.", "Escolha a carteira: um perfil, a sua carteira atual ou uma personalizada.", "Leia o cenário mediano e o ruim. Planeje contando com o ruim."],
      dica: "O juro real de longo prazo muda muito o resultado. Teste valores diferentes." },
    { rota: "historico", nome: "Histórico", paraQue: "Mostra quanto você teria hoje se tivesse começado em anos anteriores.",
      passos: ["Escolha o ano de início e os valores.", "Marque as opções para comparar.", "Ligue \"Descontar a inflação\" para ver o ganho real."],
      dica: "Rentabilidade passada não garante a futura. Use para entender o risco, não para escolher um vencedor." },
    { rota: "cripto", nome: "Cripto", paraQue: "Mostra cotações, o histórico de quedas e uma calculadora para decidir quanto colocar em cripto.",
      passos: ["Confira as cotações (no site do GitHub elas são ao vivo).", "Veja as maiores quedas do Bitcoin e do Ethereum.", "Teste na calculadora o impacto de uma queda no seu patrimônio."],
      dica: "Coloque em cripto só o que você aceitaria ver cair 80% sem mudar seus planos." },
    { rota: "renda-fixa", nome: "Renda fixa", paraQue: "Compara as ofertas de renda fixa já com IR e monta a melhor divisão do seu dinheiro entre elas.",
      passos: ["Confira as taxas de mercado: Selic, CDI e IPCA.", "Cadastre as ofertas que você vê nos seus apps, com app, teto e carência.", "Veja a melhor combinação e o rendimento líquido por prazo."],
      dica: "Marque \"Só liquidez diária\" quando o dinheiro for da reserva de emergência." },
    { rota: "onde-investir", nome: "Onde investir", paraQue: "Guia com as principais formas de investir, do Tesouro Selic ao day trade, com risco, liquidez e imposto.",
      passos: ["Filtre pelo nível de risco que combina com você.", "Leia o principal cuidado de cada opção."],
      dica: "Comece pelo risco baixo e avance aos poucos." },
    { rota: "apps", nome: "Apps e corretoras", paraQue: "Diz em qual app aplicar para cada objetivo e quanto custa, com as taxas oficiais do Tesouro do dia.",
      passos: ["Escolha o objetivo.", "Informe os valores.", "Siga a melhor escolha e confira os custos no catálogo."],
      dica: "Corrija os custos do catálogo com o que você vê no app. O hub guarda a sua correção." },
    { rota: "carteira", nome: "Minha carteira", paraQue: "Registra os seus investimentos e diz como dividir o próximo aporte para chegar à carteira do seu perfil.",
      passos: ["Adicione cada investimento com a classe e o valor atual.", "Compare a distribuição atual com o alvo.", "Use \"Próximo aporte\" para saber onde colocar o dinheiro novo."],
      dica: "Atualize os valores uma vez por mês, no dia em que for investir." },
  ];

  // Estimativas para a calculadora "quanto rende por mês" (editáveis na tela).
  const RENDA_ESTIMADA = { fii: 10, acoes: 6 }; // % ao ano: rendimentos de FIIs e dividendos de ações

  const Dados = { ANOS, DOLAR, IPCA, CLASSES, QUEDAS_CRIPTO, PREMISSAS, JURO_REAL_PADRAO, INFLACAO_PADRAO, PRODUTOS_RF,
    TESOURO_EMISSOR, FGC_LIMITE, IOF_CAMBIO, TAXA_B3, OFERTAS, PLATAFORMAS, TIPOS_PLATAFORMA, ETFS_INICIO,
    GLOSSARIO, MANUAL_MECANISMOS, MANUAL_INVESTIMENTOS, GUIA_ABAS, RENDA_ESTIMADA, CORRELACAO, PERFIS, QUESTOES, INSTRUMENTOS };
  if (typeof module !== "undefined" && module.exports) module.exports = Dados;
  else root.Dados = Dados;
})(typeof window !== "undefined" ? window : globalThis);
