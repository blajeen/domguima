# Guia de pesquisa de produtos — Dom Guima

Este guia explica as duas ferramentas de pesquisa disponíveis no cadastro de produtos:

1. comparativo de preços no Google;
2. pesquisa inteligente com IA.

As duas ferramentas são assistivas. Elas ajudam a preencher e conferir o cadastro, mas não alteram preço, estoque ou produto sozinhas.

## Como chegar às ferramentas

1. Acesse `https://www.domguima.com.br`.
2. Entre em **Acesso administrativo**.
3. Abra **Produtos**.
4. Clique em **Adicionar novo** ou abra um produto existente para editar.

No cadastro de um produto novo, selecione primeiro o setor/categoria. O sistema prepara o próximo SKU automaticamente.

## 1. Comparativo de preços no Google

Use esta ferramenta para conferir como o produto está sendo anunciado no mercado antes de definir o preço da Dom Guima.

### Passo a passo

1. Preencha pelo menos o **Nome do produto**, o **Modelo** ou o **EAN/GTIN**.
2. Vá até o bloco **Comparativo de preços**.
3. Confira o termo mostrado em **Pesquisa atual**.
4. Clique em uma das opções:
   - **Google Shopping**: procura ofertas na aba de compras do Google;
   - **Buscar preços no Google**: faz uma pesquisa geral pelo produto e pela palavra “preço”.
5. Compare produtos realmente equivalentes: mesmo modelo, capacidade, voltagem, tamanho e estado do produto.
6. Volte ao painel e preencha o preço da Dom Guima manualmente.

### O que a ferramenta não faz

- não copia preços automaticamente;
- não altera o preço da Dom Guima;
- não escolhe o menor preço de forma automática;
- não confirma que uma oferta concorrente é do mesmo modelo;
- não substitui a conferência de frete, garantia, condição e reputação do vendedor.

O objetivo é dar uma referência rápida para a decisão comercial. O preço final continua sendo definido pelo responsável da loja.

## 2. Pesquisa inteligente com IA

Use esta ferramenta para encontrar dados do produto e preparar uma primeira versão do cadastro.

### Melhor forma de preencher

Para aumentar a precisão, informe:

- **Modelo completo**, com letras, números e sufixos;
- **Marca**, quando souber;
- **EAN/GTIN**, se estiver disponível;
- **Categoria correta**;
- nome do produto, quando já souber uma parte dele.

Exemplos de modelos:

- `50UA8550PSA`;
- `LES11`;
- `BSC2050`.

Um modelo completo e o EAN/GTIN ajudam a diferenciar versões parecidas do mesmo produto.

### Passo a passo

1. Preencha o campo **Modelo**.
2. Preencha a **Marca** se souber. Se não souber, a IA tenta identificar pelo modelo.
3. Confira a categoria selecionada.
4. Clique em **Pesquisar modelo**.
5. Aguarde a prévia da pesquisa.
6. Confira:
   - nome encontrado;
   - marca;
   - confiança geral;
   - descrição;
   - especificações;
   - NCM sugerido e o nível de confiança fiscal;
   - fontes consultadas.
7. Abra a fonte oficial do fabricante e confirme se o modelo é exatamente o mesmo.
8. Se os dados estiverem corretos, clique em **Aplicar dados pesquisados**.
9. Revise o formulário completo, principalmente preço, estoque, voltagem, imagens e NCM.
10. Só então clique em **Salvar produto**.

### Ordem de pesquisa da IA

Quando a marca é informada, a IA procura primeiro no fabricante. Quando a marca está vazia, ela faz uma busca de identificação pelo modelo e depois procura o fabricante provável. Em seguida, consulta fontes gerais para complementar e comparar os dados.

A prévia mostra as fontes para permitir a conferência antes do salvamento. A pesquisa usa o serviço de web search da OpenAI no servidor; a chave da API não aparece no navegador nem deve ser colocada no formulário.

### Como interpretar a confiança

- **Alta**: o modelo foi identificado com boa segurança em fonte oficial ou documentação do fabricante.
- **Média**: existem boas evidências, mas algum dado ainda precisa de conferência.
- **Baixa**: o resultado é incompleto, o modelo é ambíguo ou não houve confirmação oficial suficiente.

Se a confiança for baixa, não aplique automaticamente. Pesquise o modelo completo, acrescente a marca ou EAN/GTIN e tente novamente.

### NCM: como usar com segurança

O NCM retornado pela IA é somente uma **sugestão fiscal**. Na prévia, ele aparece como **NCM sugerido**, acompanhado do nível de confiança e de uma observação. O NCM não é usado para decidir o preço e não altera o estoque.

Faça assim:

1. Confira se a descrição e o modelo pesquisado correspondem ao produto real.
2. Abra as fontes consultadas e veja se a classificação faz sentido para aquele produto exato.
3. Se estiver de acordo, clique em **Aplicar dados pesquisados** para levar o NCM ao campo do cadastro.
4. Confirme o código com a contabilidade ou responsável fiscal antes de emitir nota fiscal.

A IA pode deixar o NCM vazio quando não encontra evidência suficiente. Isso é intencional e mais seguro do que preencher um código sem confirmação. Nesse caso, deixe o campo vazio ou preencha somente depois da validação fiscal.

O NCM pode variar conforme características do produto e regras tributárias aplicáveis. Por isso, mesmo quando a confiança aparecer como alta ou média, a conferência fiscal continua obrigatória.

### O que é aplicado no formulário

Ao clicar em **Aplicar dados pesquisados**, a ferramenta pode preencher ou complementar:

- nome;
- marca;
- descrição;
- NCM sugerido;
- especificações;
- tags;
- fonte principal.

O sistema não salva o produto nesse momento. O cadastro só é criado ou alterado depois do clique em **Salvar produto**.

## Problemas comuns

### “O assistente online ainda não foi configurado”

A implantação ainda não recebeu a configuração da IA. É um problema de configuração da Vercel, não do produto. O responsável técnico deve verificar a variável `OPENAI_API_KEY` no ambiente **Production** e fazer um novo deploy.

### “A pesquisa demorou mais que o esperado”

Tente novamente com o modelo completo, marca e EAN/GTIN. Sites de fabricantes podem responder mais lentamente ou bloquear consultas temporariamente.

### A IA trouxe produto parecido

Não aplique os dados. Confira letras, números, sufixos, capacidade, voltagem e geração. Depois informe mais dados no cadastro e faça uma nova pesquisa.

### Não apareceu NCM

Isso não impede o cadastro. Deixe o campo vazio até confirmar o código com a contabilidade.

### As fontes não parecem oficiais

Priorize links do domínio do fabricante, manual ou suporte oficial. Use varejistas e outras fontes apenas como complemento. Se não houver fonte confiável, faça o cadastro manualmente.

## Fluxo recomendado para o dia a dia

1. Selecione o setor para gerar o SKU.
2. Informe marca, modelo, EAN/GTIN e nome parcial.
3. Use **Pesquisar modelo** para preparar o cadastro.
4. Confira a fonte oficial.
5. Aplique os dados pesquisados.
6. Use o comparativo do Google para decidir o preço.
7. Revise imagens, estoque, custo, preço e NCM.
8. Salve o produto somente quando tudo estiver correto.

Assim, a IA acelera o cadastro e o Google apoia a decisão de preço, sem tirar do responsável da Dom Guima o controle final das informações publicadas.
