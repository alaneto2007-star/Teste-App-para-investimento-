# Invest Simulador

App web de estudo para simular, organizar e planejar investimentos. É só HTML, CSS e JavaScript, sem instalar nada.

> Projeto educacional. Não é recomendação de investimento.

## Como abrir

Baixe ou clone o repositório e dê dois cliques em `index.html`. Abre no navegador.

## Funcionalidades

- **Simulador**: compara Poupança, Tesouro Selic, CDB e LCI/LCA com valor inicial, aportes mensais e prazo. Desconta o IR regressivo e mostra um gráfico da evolução. As taxas (Selic, CDI, % do CDI) são editáveis.
- **Reserva & Metas**: calcula a reserva de emergência ideal e em quanto tempo você chega a uma meta.
- **Minha carteira**: registre seus investimentos e veja a distribuição por categoria. Os dados ficam salvos no navegador (localStorage).

## Estrutura

```
index.html          página principal
css/styles.css      estilos (tema claro e escuro)
js/calc.js          funções de cálculo (juros, IR, metas)
js/app.js           interface
tests/calc.test.js  testes dos cálculos
```

## Testes

Com o Node.js instalado:

```bash
node tests/calc.test.js
```

## Limitações

- As taxas são fixas durante todo o prazo (na vida real elas mudam).
- Não considera taxa de custódia do Tesouro, IOF (resgates com menos de 30 dias) nem TR na poupança.
