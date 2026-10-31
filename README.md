# Invest Simulador

App web para estudar investimentos: perfil de risco, projeção Monte Carlo, histórico de 2016 a 2024, cripto, renda fixa e carteira com rebalanceamento. É só HTML, CSS e JavaScript, sem instalar nada.

> Projeto educacional. Nada aqui é recomendação de investimento.

## Como abrir

**Online:** https://alaneto2007-star.github.io/Teste-App-para-investimento-/ (depois de ativar o GitHub Pages, veja abaixo).

**No computador:** baixe o repositório (botão verde **Code → Download ZIP** no GitHub), extraia e dê dois cliques em `index.html`.

### Ativar o GitHub Pages (uma vez só)

1. No GitHub, abra o repositório e vá em **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**.
3. Em **Branch**, escolha `main` e a pasta `/ (root)`, depois clique em **Save**.
4. Espere 1 ou 2 minutos e acesse o link acima.

## Seções

| Seção | O que faz |
|---|---|
| **Visão geral** | Mapa de risco × retorno das 8 classes e das carteiras modelo, desempenho de cada classe de 2016 a 2024, resumo do perfil e da carteira. |
| **Meu perfil** | Questionário de 6 perguntas que define o perfil (conservador, moderado, arrojado ou agressivo) e a carteira modelo. |
| **Projeção** | Simulação Monte Carlo com milhares de cenários, retornos correlacionados entre as classes, faixas de 50% e 90%, chance de perda e queda típica no caminho. Premissas editáveis. |
| **Histórico** | Backtest com aporte inicial e mensal sobre os retornos reais de cada ano, com opção de descontar a inflação e escala logarítmica. |
| **Cripto** | Cotações ao vivo (CoinGecko), retorno anual de BTC e ETH, maiores quedas, calculadora de quanto colocar em cripto e formas de investir no Brasil. |
| **Renda fixa** | Poupança × Tesouro Selic × CDB × LCI/LCA com IR e inflação, reserva de emergência e prazo para metas. |
| **Onde investir** | 20 instrumentos, do Tesouro Selic ao day trade, com risco, liquidez, IR, mínimo e principal cuidado. |
| **Minha carteira** | Cadastro dos seus investimentos, comparação com o alvo do perfil e divisão do próximo aporte para rebalancear. |

## Dados

- **Ao vivo:** Selic, CDI, IPCA e dólar da API do Banco Central; cotações de cripto da CoinGecko. Se o navegador bloquear essas chamadas, o app usa os valores digitados na aba Renda fixa.
- **Histórico 2016–2024:** retornos anuais aproximados de CDI e IPCA (BCB/IBGE), IMA-B (Anbima), Ibovespa e IFIX (B3), S&P 500 com dividendos, ouro, Bitcoin e Ethereum, com ativos em dólar convertidos para reais. Ficam em `js/data.js`.
- **Premissas da projeção:** retorno e volatilidade esperados por classe e correlações aproximadas, também em `js/data.js`.

## Estrutura

```
index.html          página
css/styles.css      estilos (tema claro e escuro)
js/data.js          dados de referência, perfis, questionário e catálogo
js/calc.js          cálculos: juros, IR, estatísticas, backtest, Monte Carlo, perfil, rebalanceamento
js/charts.js        gráficos em SVG (linhas com faixas, barras, rosca, dispersão, minigráfico)
js/live.js          busca de dados no Banco Central e na CoinGecko
js/app.js           interface
tests/calc.test.js  testes dos cálculos
```

## Testes

```bash
node tests/calc.test.js
```

## Limitações

- Histórico com granularidade anual: quedas dentro de um mesmo ano não aparecem no backtest.
- A projeção depende das premissas; elas são estimativas, não promessas.
- Regras de imposto de renda conforme a legislação de 2025. Confira antes de investir.
