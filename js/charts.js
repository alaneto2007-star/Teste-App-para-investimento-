// Gráficos em SVG puro (linha com faixas, barras, rosca, dispersão e minigráfico).
// Cada gráfico se redesenha ao mudar de tamanho e mostra tooltip ao passar o mouse ou tocar.

(function (root) {
  const NS = "http://www.w3.org/2000/svg";
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Escala "bonita" para o eixo: devolve ticks redondos que cobrem [min, max].
  function ticks(min, max, alvo = 5) {
    if (min === max) { max = min + 1; }
    const passoBruto = (max - min) / alvo;
    const mag = Math.pow(10, Math.floor(Math.log10(passoBruto)));
    const norm = passoBruto / mag;
    const passo = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const ini = Math.floor(min / passo) * passo;
    const fim = Math.ceil(max / passo) * passo;
    const out = [];
    for (let v = ini; v <= fim + passo / 2; v += passo) out.push(+v.toFixed(10));
    return out;
  }

  // Registra um gráfico: desenha agora e sempre que o contêiner mudar de largura ou o tema mudar.
  const registrados = new Map();
  function montar(el, desenhar) {
    registrados.set(el, desenhar);
    if (!el._ro) {
      let largura = 0;
      el._ro = new ResizeObserver(() => {
        if (el.clientWidth !== largura) { largura = el.clientWidth; registrados.get(el)?.(); }
      });
      el._ro.observe(el);
    }
    desenhar();
  }
  function redesenharTodos() { registrados.forEach((fn, el) => el.isConnected && fn()); }
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", redesenharTodos);
  new MutationObserver(redesenharTodos).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-tema"] });

  function tooltip(el) {
    let t = el.querySelector(".tt");
    if (!t) { t = document.createElement("div"); t.className = "tt"; t.hidden = true; el.appendChild(t); }
    return t;
  }
  function posicionarTooltip(el, t, x, y) {
    const w = el.clientWidth;
    t.hidden = false;
    const tw = t.offsetWidth;
    let left = x + 14;
    if (left + tw > w) left = x - tw - 14;
    t.style.left = Math.max(0, left) + "px";
    t.style.top = Math.max(0, y - 10) + "px";
  }

  // ---------- Linhas (com faixas opcionais) ----------
  // opts: { x: [rótulos], series: [{ nome, cor, valores, tracejado, largura }], faixas: [{ lo, hi, cor, opacidade }],
  //         yFmt, xFmt, altura, linhasTooltip(i) -> [{ cor, nome, valor }], xTicks: n }
  function linhas(el, opts) {
    montar(el, () => {
      const W = Math.max(280, el.clientWidth), H = opts.altura || 300;
      const mE = opts.margemEsq || 64, mD = 14, mT = 12, mB = 30;
      const w = W - mE - mD, h = H - mT - mB;
      const todos = [];
      opts.series.forEach((s) => s.valores.forEach((v) => v != null && todos.push(v)));
      (opts.faixas || []).forEach((f) => { todos.push(...f.lo, ...f.hi); });
      let min = Math.min(0, ...todos), max = Math.max(...todos);
      const tk = opts.yTicks ? opts.yTicks(Math.min(...todos), max) : ticks(min, max, 4);
      min = tk[0]; max = tk[tk.length - 1];
      const n = opts.x.length;
      const X = (i) => mE + (n === 1 ? w / 2 : (i / (n - 1)) * w);
      const Y = (v) => mT + h - ((v - min) / (max - min)) * h;
      const yFmt = opts.yFmt || ((v) => v);
      const xFmt = opts.xFmt || ((v) => v);

      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(opts.rotulo || "Gráfico de linhas")}">`;
      tk.forEach((v) => {
        s += `<line x1="${mE}" x2="${W - mD}" y1="${Y(v)}" y2="${Y(v)}" stroke="${css("--grade")}" stroke-width="1" ${v === 0 ? "" : 'stroke-dasharray="2 4"'} />`;
        s += `<text x="${mE - 8}" y="${Y(v) + 4}" text-anchor="end" class="eixo-txt">${esc(yFmt(v))}</text>`;
      });
      const qtdX = Math.min(n, opts.xTicks || 6);
      for (let k = 0; k < qtdX; k++) {
        const i = qtdX === 1 ? 0 : Math.round((k / (qtdX - 1)) * (n - 1));
        s += `<text x="${X(i)}" y="${H - 8}" text-anchor="${k === 0 ? "start" : k === qtdX - 1 ? "end" : "middle"}" class="eixo-txt">${esc(xFmt(opts.x[i]))}</text>`;
      }
      (opts.faixas || []).forEach((f) => {
        const top = f.hi.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
        const bot = f.lo.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).reverse();
        s += `<polygon points="${top.concat(bot).join(" ")}" fill="${f.cor}" fill-opacity="${f.opacidade ?? 0.18}" stroke="none" />`;
      });
      opts.series.forEach((se) => {
        const pts = se.valores.map((v, i) => (v == null ? null : `${X(i).toFixed(1)},${Y(v).toFixed(1)}`)).filter(Boolean).join(" ");
        s += `<polyline points="${pts}" fill="none" stroke="${se.cor}" stroke-width="${se.largura || 2}" stroke-linejoin="round" stroke-linecap="round" ${se.tracejado ? 'stroke-dasharray="5 5"' : ""} />`;
        if (!se.tracejado) {
          const ult = se.valores.length - 1;
          s += `<circle cx="${X(ult)}" cy="${Y(se.valores[ult])}" r="4" fill="${se.cor}" stroke="${css("--painel")}" stroke-width="2" />`;
        }
      });
      s += `<line class="mira" x1="0" x2="0" y1="${mT}" y2="${mT + h}" stroke="${css("--tinta-2")}" stroke-width="1" visibility="hidden" />`;
      s += `<rect x="${mE}" y="${mT}" width="${w}" height="${h}" fill="transparent" class="alvo" />`;
      s += "</svg>";
      el.innerHTML = s;

      const svg = el.querySelector("svg"), mira = svg.querySelector(".mira"), t = tooltip(el);
      const linhasTt = opts.linhasTooltip || ((i) => opts.series.map((se) => ({ cor: se.cor, nome: se.nome, valor: yFmt(se.valores[i]) })));
      function mover(ev) {
        const r = svg.getBoundingClientRect();
        const px = ((ev.clientX - r.left) / r.width) * W;
        const i = Math.max(0, Math.min(n - 1, Math.round(((px - mE) / w) * (n - 1))));
        mira.setAttribute("x1", X(i)); mira.setAttribute("x2", X(i)); mira.setAttribute("visibility", "visible");
        t.innerHTML = `<strong>${esc(opts.xTooltip ? opts.xTooltip(opts.x[i]) : xFmt(opts.x[i]))}</strong>` +
          linhasTt(i).map((l) => `<div class="tt-linha"><span class="tt-cor" style="background:${l.cor}"></span><span>${esc(l.nome)}</span><b>${esc(l.valor)}</b></div>`).join("");
        posicionarTooltip(el, t, (X(i) / W) * r.width, ev.clientY - r.top);
      }
      const sair = () => { mira.setAttribute("visibility", "hidden"); t.hidden = true; };
      const alvo = svg.querySelector(".alvo");
      alvo.addEventListener("pointermove", mover);
      alvo.addEventListener("pointerdown", mover);
      alvo.addEventListener("pointerleave", sair);
    });
  }

  // ---------- Barras verticais com base no zero (positivo/negativo) ----------
  // opts: { rotulos, grupos: [{ nome, cor, valores }], yFmt, altura }
  function barras(el, opts) {
    montar(el, () => {
      const W = Math.max(280, el.clientWidth), H = opts.altura || 260;
      const vals = opts.grupos.flatMap((g) => g.valores);
      const mE = 56, mD = 8, mT = 12, mB = 28;
      const w = W - mE - mD, h = H - mT - mB;
      const cortados = [];
      let min = Math.min(0, ...vals), max = Math.max(0, ...vals);
      if (opts.limite) { min = Math.max(min, -opts.limite); max = Math.min(max, opts.limite); }
      const tk = ticks(min, max, 4);
      min = tk[0]; max = tk[tk.length - 1];
      const Y = (v) => mT + h - ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * h;
      const n = opts.rotulos.length, g = opts.grupos.length;
      const banda = w / n, larg = Math.min(28, (banda - 8) / g - 2);
      const yFmt = opts.yFmt || ((v) => v);

      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(opts.rotulo || "Gráfico de barras")}">`;
      tk.forEach((v) => {
        s += `<line x1="${mE}" x2="${W - mD}" y1="${Y(v)}" y2="${Y(v)}" stroke="${css(v === 0 ? "--tinta-3" : "--grade")}" ${v === 0 ? "" : 'stroke-dasharray="2 4"'} />`;
        s += `<text x="${mE - 8}" y="${Y(v) + 4}" text-anchor="end" class="eixo-txt">${esc(yFmt(v))}</text>`;
      });
      opts.rotulos.forEach((rot, i) => {
        const cx = mE + banda * i + banda / 2;
        s += `<text x="${cx}" y="${H - 8}" text-anchor="middle" class="eixo-txt">${esc(rot)}</text>`;
        opts.grupos.forEach((gr, j) => {
          const v = gr.valores[i];
          const x = cx - (g * (larg + 2)) / 2 + j * (larg + 2);
          const y0 = Y(0), y1 = Y(v);
          const topo = Math.min(y0, y1), alt = Math.max(1, Math.abs(y1 - y0));
          const r = Math.min(4, larg / 2, alt);
          // Ponta arredondada só no lado do valor; lado da base reto.
          const d = v >= 0
            ? `M${x},${y0} V${topo + r} Q${x},${topo} ${x + r},${topo} H${x + larg - r} Q${x + larg},${topo} ${x + larg},${topo + r} V${y0} Z`
            : `M${x},${y0} V${topo + alt - r} Q${x},${topo + alt} ${x + r},${topo + alt} H${x + larg - r} Q${x + larg},${topo + alt} ${x + larg},${topo + alt - r} V${y0} Z`;
          s += `<path d="${d}" fill="${gr.cor}" data-i="${i}" data-j="${j}" class="barra" />`;
          if (opts.limite && Math.abs(v) > opts.limite) {
            // Sinal de quebra: duas faixas na cor do painel perto da ponta indicam que a barra foi cortada.
            const yq = v > 0 ? topo + 10 : topo + alt - 14;
            cortados.push(`<path d="M${x - 1},${yq + 2} L${x + larg + 1},${yq - 2} M${x - 1},${yq + 6} L${x + larg + 1},${yq + 2}" stroke="${css("--painel")}" stroke-width="2" fill="none" />`);
          }
        });
      });
      s += cortados.join("") + "</svg>";
      el.innerHTML = s;
      const svg = el.querySelector("svg"), t = tooltip(el);
      svg.querySelectorAll(".barra").forEach((b) => {
        const mostrar = (ev) => {
          const i = +b.dataset.i;
          const r = svg.getBoundingClientRect();
          t.innerHTML = `<strong>${esc(opts.rotulos[i])}</strong>` + opts.grupos.map((gr) =>
            `<div class="tt-linha"><span class="tt-cor" style="background:${gr.cor}"></span><span>${esc(gr.nome)}</span><b>${esc(yFmt(gr.valores[i]))}</b></div>`).join("");
          posicionarTooltip(el, t, ev.clientX - r.left, ev.clientY - r.top);
        };
        b.addEventListener("pointermove", mostrar);
        b.addEventListener("pointerdown", mostrar);
        b.addEventListener("pointerleave", () => (t.hidden = true));
      });
    });
  }

  // ---------- Rosca ----------
  // itens: [{ nome, valor, cor }], centro: { valor, rotulo }
  function rosca(el, itens, centro) {
    montar(el, () => {
      const S = 200, R = 92, r = 62;
      const total = itens.reduce((a, b) => a + b.valor, 0) || 1;
      let ang = -Math.PI / 2;
      let s = `<svg viewBox="0 0 ${S} ${S}" role="img" aria-label="Gráfico de rosca">`;
      const visiveis = itens.filter((i) => i.valor > 0);
      if (!visiveis.length) s += `<circle cx="100" cy="100" r="${(R + r) / 2}" fill="none" stroke="${css("--grade")}" stroke-width="${R - r}" />`;
      visiveis.forEach((it) => {
        const frac = it.valor / total;
        const a0 = ang, a1 = ang + frac * Math.PI * 2;
        ang = a1;
        const gap = visiveis.length > 1 ? 0.012 : 0;
        const p = (rad, a) => `${(100 + rad * Math.cos(a)).toFixed(2)},${(100 + rad * Math.sin(a)).toFixed(2)}`;
        const grande = a1 - a0 - 2 * gap > Math.PI ? 1 : 0;
        if (frac >= 0.9999) {
          s += `<circle cx="100" cy="100" r="${(R + r) / 2}" fill="none" stroke="${it.cor}" stroke-width="${R - r}" data-nome="${esc(it.nome)}" class="fatia" />`;
        } else {
          s += `<path class="fatia" data-nome="${esc(it.nome)}" fill="${it.cor}" d="M${p(R, a0 + gap)} A${R},${R} 0 ${grande} 1 ${p(R, a1 - gap)} L${p(r, a1 - gap)} A${r},${r} 0 ${grande} 0 ${p(r, a0 + gap)} Z" />`;
        }
      });
      if (centro) {
        s += `<text x="100" y="98" text-anchor="middle" class="rosca-valor">${esc(centro.valor)}</text>`;
        s += `<text x="100" y="118" text-anchor="middle" class="eixo-txt">${esc(centro.rotulo)}</text>`;
      }
      s += "</svg>";
      el.innerHTML = s;
      const t = tooltip(el), svg = el.querySelector("svg");
      svg.querySelectorAll(".fatia").forEach((f) => {
        const it = visiveis.find((i) => i.nome === f.dataset.nome);
        const mostrar = (ev) => {
          const rr = el.getBoundingClientRect();
          t.innerHTML = `<div class="tt-linha"><span class="tt-cor" style="background:${it.cor}"></span><span>${esc(it.nome)}</span><b>${((it.valor / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</b></div>`;
          posicionarTooltip(el, t, ev.clientX - rr.left, ev.clientY - rr.top);
        };
        f.addEventListener("pointermove", mostrar);
        f.addEventListener("pointerdown", mostrar);
        f.addEventListener("pointerleave", () => (t.hidden = true));
      });
    });
  }

  // ---------- Dispersão com rótulos diretos ----------
  // pontos: [{ x, y, rotulo, cor, destaque, grupo }]. opts.ligar: nome do grupo cujos pontos são ligados por uma linha.
  // Eixo x em escala de raiz quadrada (opts.raizX) para abrir espaço na região de baixo risco.
  function dispersao(el, pontos, opts) {
    montar(el, () => {
      const W = Math.max(280, el.clientWidth), H = opts.altura || 320;
      const estreito = W < 520;
      const mE = 52, mD = 16, mT = 14, mB = 44;
      const w = W - mE - mD, h = H - mT - mB;
      const xMax = Math.max(...pontos.map((p) => p.x)) * 1.08;
      const fx = opts.raizX ? Math.sqrt : (v) => v;
      const tx = opts.raizX ? [0, 5, 10, 20, 40, 60, 80, 100, 150].filter((v, i, a) => v <= xMax || a[i - 1] < xMax) : ticks(0, xMax, 5);
      const ys = pontos.map((p) => p.y);
      const ty = ticks(Math.max(0, Math.min(...ys) - 2), Math.max(...ys) + 2, 4);
      const X = (v) => mE + (fx(v) / fx(tx[tx.length - 1])) * w;
      const Y = (v) => mT + h - ((v - ty[0]) / (ty[ty.length - 1] - ty[0])) * h;
      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(opts.rotulo || "Dispersão")}">`;
      ty.forEach((v) => {
        s += `<line x1="${mE}" x2="${W - mD}" y1="${Y(v)}" y2="${Y(v)}" stroke="${css("--grade")}" stroke-dasharray="2 4" />`;
        s += `<text x="${mE - 8}" y="${Y(v) + 4}" text-anchor="end" class="eixo-txt">${esc(opts.yFmt(v))}</text>`;
      });
      tx.forEach((v, i) => {
        if (estreito && i % 2 === 1 && i !== tx.length - 1) return;
        s += `<line x1="${X(v)}" x2="${X(v)}" y1="${mT}" y2="${mT + h}" stroke="${css("--grade")}" stroke-dasharray="2 4" />`;
        s += `<text x="${X(v)}" y="${mT + h + 18}" text-anchor="middle" class="eixo-txt">${esc(opts.xFmt(v))}</text>`;
      });
      s += `<text x="${mE + w / 2}" y="${H - 4}" text-anchor="middle" class="eixo-txt forte">${esc(opts.xRotulo)}</text>`;
      s += `<text x="12" y="${mT + h / 2}" text-anchor="middle" class="eixo-txt forte" transform="rotate(-90 12 ${mT + h / 2})">${esc(opts.yRotulo)}</text>`;

      if (opts.ligar) {
        const lig = pontos.filter((p) => p.grupo === opts.ligar).sort((a, b) => a.x - b.x);
        s += `<polyline points="${lig.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")}" fill="none" stroke="${css("--tinta-3")}" stroke-width="1.5" stroke-dasharray="4 3" />`;
      }
      // Posiciona rótulos sem colisão: tenta direita, esquerda, acima e abaixo do ponto.
      const caixas = pontos.map((p) => ({ x0: X(p.x) - 8, x1: X(p.x) + 8, y0: Y(p.y) - 8, y1: Y(p.y) + 8 }));
      const colide = (a) => caixas.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0);
      const rotulos = [];
      const ordem = pontos.map((p, i) => i).sort((a, b) => (pontos[b].destaque ? 1 : 0) - (pontos[a].destaque ? 1 : 0));
      ordem.forEach((i) => {
        const p = pontos[i];
        if (!p.rotulo) return;
        const cx = X(p.x), cy = Y(p.y), lw = p.rotulo.length * (p.destaque ? 7.4 : 6.6), lh = 14;
        const tentativas = [
          { a: "start", x: cx + 11, y: cy + 4 }, { a: "end", x: cx - 11, y: cy + 4 },
          { a: "middle", x: cx, y: cy - 13 }, { a: "middle", x: cx, y: cy + 21 },
          { a: "start", x: cx + 9, y: cy - 11 }, { a: "start", x: cx + 9, y: cy + 19 },
          { a: "end", x: cx - 9, y: cy - 11 }, { a: "end", x: cx - 9, y: cy + 19 },
        ];
        const caixa = (t) => {
          const x0 = t.a === "start" ? t.x : t.a === "end" ? t.x - lw : t.x - lw / 2;
          return { x0, x1: x0 + lw, y0: t.y - 11, y1: t.y - 11 + lh };
        };
        const dentro = (c) => c.x0 >= mE - 4 && c.x1 <= W - 2 && c.y0 >= 0 && c.y1 <= mT + h;
        const t = tentativas.find((t) => dentro(caixa(t)) && !colide(caixa(t)));
        if (!t) return; // sem espaço: o nome aparece no tooltip
        caixas.push(caixa(t));
        rotulos.push(`<text x="${t.x}" y="${t.y}" text-anchor="${t.a}" class="rotulo-ponto${p.destaque ? " forte" : ""}">${esc(p.rotulo)}</text>`);
      });
      const anel = css("--painel");
      pontos.forEach((p, i) => {
        s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.destaque ? 8 : p.grupo ? 5 : 6.5}" fill="${p.cor}" stroke="${anel}" stroke-width="2" class="ponto-d" data-i="${i}" />`;
      });
      s += rotulos.join("") + "</svg>";
      el.innerHTML = s;
      const t = tooltip(el), svg = el.querySelector("svg");
      svg.querySelectorAll(".ponto-d").forEach((c) => {
        const p = pontos[+c.dataset.i];
        const mostrar = (ev) => {
          const r = svg.getBoundingClientRect();
          t.innerHTML = `<strong>${esc(p.nomeTooltip || p.rotulo)}</strong><div class="tt-linha"><span>${esc(opts.yRotulo)}</span><b>${esc(opts.yFmt(p.y))}</b></div><div class="tt-linha"><span>${esc(opts.xRotulo)}</span><b>${esc(opts.xFmt(p.x))}</b></div>`;
          posicionarTooltip(el, t, ev.clientX - r.left, ev.clientY - r.top);
        };
        c.addEventListener("pointermove", mostrar);
        c.addEventListener("pointerdown", mostrar);
        c.addEventListener("pointerleave", () => (t.hidden = true));
      });
    });
  }

  // ---------- Minigráfico (string SVG) ----------
  function mini(valores, cor, w = 96, h = 28) {
    if (!valores || valores.length < 2) return "";
    const min = Math.min(...valores), max = Math.max(...valores);
    const X = (i) => (i / (valores.length - 1)) * (w - 4) + 2;
    const Y = (v) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
    const pts = valores.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    const area = `2,${h} ${pts} ${w - 2},${h}`;
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polygon points="${area}" fill="${cor}" fill-opacity="0.14" /><polyline points="${pts}" fill="none" stroke="${cor}" stroke-width="1.6" /><circle cx="${X(valores.length - 1)}" cy="${Y(valores[valores.length - 1])}" r="2.5" fill="${cor}" /></svg>`;
  }

  root.Charts = { linhas, barras, rosca, dispersao, mini, css, ticks, redesenharTodos };
})(window);
