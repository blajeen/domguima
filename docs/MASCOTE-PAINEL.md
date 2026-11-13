# Mascote do painel

O personagem é decorativo, sem voz, interação ou painel de configuração. Só é montado no layout autenticado de `/painel`; não aparece no login nem na loja. O canvas é transparente, fica fixo no canto inferior direito e não intercepta cliques. A animação pausa em abas ocultas, respeita redução de movimento e some na impressão.

O modelo `public/mascot/dom-guima.glb` veio do arquivo Tripo enviado pelo proprietário em Downloads. A revisão no Blender manteve 65 ossos e a identidade da foto, refinou discretamente a camiseta e as bochechas, normalizou os pesos em 18.582 vértices, suavizou ombros/cotovelos/joelhos e isolou cabeça e cabelo dos ombros. O deslocamento horizontal das danças foi fixado e as escalas dos ossos estabilizadas.

O arquivo original tinha quatro danças e um clipe `cry`. A sequência publicada usa `dance_01`, `dance_02`, `dance_03`, `dance_05` e uma variação espelhada `dance_04_mirrored`, sem o choro. Há transições de 450 ms e descarte das ações encerradas. A câmera é calculada a partir das poses das cinco animações para incluir corpo e mãos.

O mapa de cor usa 2048 px para preservar os detalhes do rosto; os mapas auxiliares usam 1024 px. O original editável em alta resolução foi preservado localmente em `Dom-Guima-rig-revisado-v2.blend`. Nenhuma API externa ou serviço pago é usado na reprodução.

Validação: TypeScript, ESLint, build de produção e navegador Edge com login local de teste. Conferidos movimento em quadros distintos, persistência entre rotas, posição no celular, redução de movimento, ausência no login/loja e ausência de erros JavaScript.

## Segunda revisão — 13/11/2026

- Corrigida a influência do pescoço no queixo e na parte inferior do rosto; a cabeça inteira acompanha o osso da cabeça.
- Removida progressivamente a influência de ossos das pernas em 2.097 pontos da camiseta, mantendo a continuidade perto da cintura.
- Reconciliados pesos em 6.476 grupos de vértices coincidentes nas divisões de UV e suavizadas as transições pelas conexões reais da superfície.
- Atenuada a flexão exagerada dos dedos nas cinco danças, mantendo a coreografia dos braços e do corpo.
- Removido o pico artificial no contorno do cabelo, suavizadas pequenas irregularidades nos lábios/dentes, corrigidas as normais nas divisões de UV e ajustados tom da pele e intensidade do mapa normal.
- Nas mesmas 30 poses de comparação, a soma de arestas esticadas além do dobro caiu de 3.352 para 2.582; o maior fator caiu de 11,32 para 8,70. Esse é um diagnóstico comparativo das poses amostradas.
- As cinco animações do GLB final também foram verificadas em 24 amostras cada: pesos normalizados, coordenadas finitas e limites do corpo estáveis. Arquivo web: aproximadamente 3,5 MB. A URL leva `?v=2` para atualizar o cache.
