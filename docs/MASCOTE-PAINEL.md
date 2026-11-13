# Mascote do painel

O personagem é decorativo, sem voz, interação ou painel de configuração. Só é montado no layout autenticado de `/painel`; não aparece no login nem na loja. O canvas é transparente, fica fixo no canto inferior direito e não intercepta cliques. A animação pausa em abas ocultas, respeita redução de movimento e some na impressão.

O modelo `public/mascot/dom-guima.glb` veio do arquivo Tripo enviado pelo proprietário em Downloads. A revisão no Blender manteve 65 ossos e a identidade da foto, refinou discretamente a camiseta e as bochechas, normalizou os pesos em 18.582 vértices, suavizou ombros/cotovelos/joelhos e isolou cabeça e cabelo dos ombros. O deslocamento horizontal das danças foi fixado e as escalas dos ossos estabilizadas.

O arquivo original tinha quatro danças e um clipe `cry`. A sequência publicada usa `dance_01`, `dance_02`, `dance_03`, `dance_05` e uma variação espelhada `dance_04_mirrored`, sem o choro. Há transições de 450 ms e descarte das ações encerradas. A câmera é calculada a partir das poses das cinco animações para incluir corpo e mãos.

As texturas de 1024 px são uma versão leve para o pequeno personagem no painel. O original editável em alta resolução foi preservado localmente em `Dom-Guima-rig-revisado.blend`. Nenhuma API externa ou serviço pago é usado na reprodução.

Validação: TypeScript, ESLint, build de produção e navegador Edge com login local de teste. Conferidos movimento em quadros distintos, persistência entre rotas, posição no celular, redução de movimento, ausência no login/loja e ausência de erros JavaScript.
