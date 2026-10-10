# LeRunners — Halloween 31/10/2026

Site responsivo de confirmação de presença, com fotografias originais, dados sincronizados em tempo real, lista de confirmados e convite por WhatsApp.

## Arquivos de publicação

- `index.html` — site público e painel de configurações acessível pelo botão na barra superior.
- `app.js` — confirmação de presença, convidados, lista em tempo real, WhatsApp, relatório e configurações.
- `service-worker.js` e `manifest.webmanifest` — PWA/cache (versão v3).
- `assets/fotos/` — fotos originais, convite horizontal `convite-og.jpg` e vertical `convite-whatsapp.jpg`.
- `assets/videos/` — vídeo original da chácara.
- `assets/icones/` — ícones do aplicativo.

## Comportamento

**Visitante:** confirma Sim/Não/Talvez, informa convidados (quantidade e nomes), preferência de hambúrguer, fantasia opcional, o que poderá levar e observações. Dados de contribuição e observações NÃO são exibidos na lista pública; a lista exibe nome, acompanhantes e situação de presença. Filtro público inicia em Confirmados. Botão **Atualizar lista no WhatsApp** envia os nomes e contagens atuais ao grupo. O envio é iniciado pelo usuário; a página não edita automaticamente mensagens já postadas no WhatsApp.

**Configurações:** o botão superior abre a solicitação de senha; após informar `Leandro`, mostra contagens do planejamento, itens que levarão, observações, PDF, edição de horário/local e remoção de registros; há também o botão **Enviar convite com imagem**. Em celulares com compartilhamento de arquivos Web Share, ele envia a imagem junto ao texto e ao link; em outros navegadores abre o WhatsApp com o link e o cartão de prévia OG (o WhatsApp pode atualizar a prévia após cache). Há opções de baixar imagem ou copiar link.

**Fotografias:** fotos da confraternização anterior aparecem como lembranças do evento passado. As fotografias dos hambúrgueres ilustram o cardápio que será preparado em 31/10 — não são apresentadas como sendo da última festa. As pessoas das fotografias não foram recriadas por IA.

## Dados preservados

O Firebase `lerunners-evento` e seus caminhos existentes permanecem sem alteração ou migração:

- Halloween: `lerunners_lista/halloween_2026/respostas`
- Configuração Halloween: `lerunners_config/halloween_2026`
- Eventos anteriores: mantidos integralmente no mesmo banco.

Campos antigos de registros pré-v3 continuam legíveis. Confirmações novas salvam `guests` (nomes dos acompanhantes), e `people` permanece como total de pessoas. O campo antigo de piscina não é coletado nem mostrado. O botão de exclusão em Configurações continua limitado à lista Halloween 2026 e exige confirmação explícita.

## Proteção de dados — importante

A senha `Leandro` é **uma restrição visual da interface**; não é autenticação real: os arquivos do GitHub Pages são públicos, inclusive o JavaScript. Se as regras Firebase estiverem abertas a usuários anônimos, uma pessoa com conhecimento técnico pode acessar dados ou operações por fora do site. Para garantir segurança real, **é necessário configurar conta administrativa no Firebase Auth e regras RTDB que restrinjam leitura de contribuições/observações e alterações administrativas a essa conta**. Essas alterações exigem analisar as regras atuais e não foram efetuadas sem acesso/validação do ambiente. Para privacidade estrita, dados administrativos devem ser armazenados em caminho separado com leitura somente administrativa (e o formulário público deve gravar informações por uma função/serviço com permissões apropriadas). Não trate a senha embutida no JavaScript como proteção suficiente.

## Publicação

Subir todo o conteúdo do ZIP na raiz do repositório `tsvalencio-IA/LeRunners`, branch `main`, GitHub Pages. A prévia do WhatsApp utiliza URL absoluta:

`https://tsvalencio-ia.github.io/LeRunners/assets/fotos/convite-og.jpg`

Atualizar horário e local verdadeiro em Configurações antes de compartilhar. Estes dados não foram inventados.

## Validação recomendada

1. Abrir no Android e no computador; fotos e imagens do convite devem carregar.
2. Registrar Sim + 2 convidados com nomes; conferir contagem e lista ao vivo em outro aparelho.
3. Editar a mesma resposta (Sim/Talvez/Não); checar contadores.
4. Verificar que PDF, contribuições e controles de exclusão não aparecem sem entrar em Configurações.
5. Entrar pelo botão superior, informar a senha e gerar PDF; conferir no Chrome Android.
6. Compartilhar a lista no WhatsApp e conferir nomes, acompanhantes e link.
7. Clicar em Enviar convite com imagem e conferir a prévia/compartilhamento do Android.
8. Verificar as regras RTDB e a separação de acesso antes de divulgar a toda a equipe.

Powered by thIAguinho Soluções Digitais.
