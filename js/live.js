// Dados ao vivo: Banco Central (API SGS) e CoinGecko.
// Se o navegador bloquear ou a API não responder, o app segue com os valores manuais.

(function (root) {
  const SERIES_BCB = { selic: 432, cdi: 4389, ipca: 13522, dolar: 1 };

  async function json(url, ms = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Devolve { selic, cdi, ipca, dolar } com { valor, data } para cada série que respondeu.
  async function bancoCentral() {
    const chaves = Object.keys(SERIES_BCB);
    const res = await Promise.allSettled(
      chaves.map((k) => json(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SERIES_BCB[k]}/dados/ultimos/1?formato=json`))
    );
    const out = {};
    res.forEach((r, i) => {
      if (r.status !== "fulfilled" || !Array.isArray(r.value) || !r.value.length) return;
      const ult = r.value[r.value.length - 1];
      const valor = parseFloat(String(ult.valor).replace(",", "."));
      if (Number.isFinite(valor)) out[chaves[i]] = { valor, data: ult.data };
    });
    return out;
  }

  const MOEDAS = ["bitcoin", "ethereum", "solana", "ripple", "binancecoin", "tether"];

  // Cotações em reais com variação de 24h, 7 dias e 1 ano, e minigráfico de 7 dias.
  async function cripto() {
    const url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&ids=" + MOEDAS.join(",") +
      "&sparkline=true&price_change_percentage=24h,7d,1y";
    const lista = await json(url);
    if (!Array.isArray(lista) || !lista.length) throw new Error("resposta vazia");
    return lista
      .map((m) => ({
        id: m.id,
        nome: m.name,
        simbolo: String(m.symbol || "").toUpperCase(),
        preco: m.current_price,
        capitalizacao: m.market_cap,
        var24h: m.price_change_percentage_24h_in_currency ?? m.price_change_percentage_24h,
        var7d: m.price_change_percentage_7d_in_currency,
        var1a: m.price_change_percentage_1y_in_currency,
        spark: (m.sparkline_in_7d?.price || []).filter((_, i, a) => i % 4 === 0 || i === a.length - 1),
      }))
      .sort((a, b) => (b.capitalizacao || 0) - (a.capitalizacao || 0));
  }

  // Taxas do Tesouro Direto gravadas pelo robô do GitHub (data/tesouro.json, publicado junto com o site).
  // Fora do GitHub Pages (arquivo aberto no computador, link do Claude) o arquivo não existe: devolve null.
  async function tesouro() {
    try {
      const d = await json("data/tesouro.json", 6000);
      return d && Array.isArray(d.titulos) && d.titulos.length ? d : null;
    } catch {
      return null;
    }
  }

  root.Live = { bancoCentral, cripto, tesouro };
})(window);
