# LeRunners — Confraternização de Halloween 2026

Formulário mobile-first para **sábado, 31 de outubro de 2026**, feito a partir de `LeRunners-main (1).zip`.

## Publicar no GitHub Pages (pelo celular)

1. **Extraia** o arquivo ZIP deste pacote. O GitHub **não descompacta** automaticamente um ZIP enviado como arquivo.
2. Abra o repositório GitHub da LeRunners e envie **o conteúdo extraído** mantendo a mesma estrutura. O arquivo `index.html` deve ficar na **raiz** do repositório, junto de `app.js`, `manifest.webmanifest`, `service-worker.js` e da pasta `assets/` com todas as subpastas.
3. Em `Settings` → `Pages`, configure o deploy da branch `main` e pasta `/ (root)`, se já não estiver configurado.
4. Abra a URL do GitHub Pages, confira a etiqueta de status perto do topo e teste o envio de uma resposta. No WhatsApp, toque em **Compartilhar** para enviar a URL ao grupo.
5. No painel ⚙ Organizador, confira e atualize **horário e orientação de local** antes de distribuir o convite; não foram inventados horário nem endereço.

## Firebase existente preservado

Firebase: `lerunners-evento`, com a mesma configuração do sistema original, Authentication Anonymous e Realtime Database.

**Caminhos históricos NÃO removidos:**
- `lerunners_lista` — registros anteriores do formulário AMICC, mantidos no RTDB;
- `lerunners_config` — configuração AMICC anterior, mantida no RTDB.

**Novo evento (separado dentro da base existente):**
- `lerunners_lista/halloween_2026/respostas` — confirmações de presença;
- `lerunners_config/halloween_2026` — informações de horário e local.

O código **não executa migração nem exclusão do histórico antigo**. Ao usar o botão de limpeza, a exclusão fica limitada a `lerunners_lista/halloween_2026/respostas`, mediante confirmação por frase.

**ATENÇÃO — etapa que não pode ser confirmada somente pelo ZIP:** verifique as regras vigentes do Firebase Realtime Database. Para o formulário funcionar ao vivo, o usuário autenticado anonimamente precisa conseguir ler e gravar os caminhos de Halloween. Isso **não é comprovável apenas com o código**. Se a regra herdada autorizava leitura/gravação autenticadas em `lerunners_lista` e `lerunners_config`, em geral as permissões são herdadas pelos filhos, a menos que exista validação restritiva. Caso contrário, será necessário ajustar essas regras sem substituir indiscriminadamente as permissões atuais. Não aplique regras públicas globais `".read": true` ou `".write": true`.

### Segurança do painel

Foi mantida a senha de acesso **visual** do organizador do formulário anterior para preservar o uso familiar. **Senha dentro de HTML/JavaScript público não representa proteção real dos dados.** O acesso real é regido pelas regras Firebase. Com permissões amplas para usuários anônimos, qualquer pessoa tecnicamente pode enviar modificações diretamente ao banco, independentemente do que aparece na interface. Antes de compartilhar com muitos usuários, recomenda-se proteger ações administrativas com conta autenticada específica e regras que verifiquem uma reivindicação administrativa ou UID confiável. Isso requer configurar as regras e a conta administrativa no console Firebase; **não foi ativado sem suas regras atuais**.

## Como funciona

- Cadastro/resposta ao vivo: Sim, Não, Talvez.
- Quantidade de pessoas; cardápio; piscina; fantasia; contribuições opcionais; recados.
- Contadores instantâneos, filtros, pesquisa, lista por nome, estimativas para organização.
- Na mesma instalação/navegador, o mesmo visitante pode atualizar sua resposta, sem gerar outro registro; a identidade anônima do Firebase e o identificador local são utilizados.
- Compartilhar o convite pelo WhatsApp com quantidades e link.
- Gerar PDF A4 horizontal da lista e dos detalhes.
- Painel organizador: editar local, horário, título e texto; remover registros e limpar **somente Halloween 2026**.
- PWA para instalação opcional no celular, com cache de assets visuais. **Respostas sempre precisam de conexão com Firebase.**
- Galeria das fotos originais e vídeo da chácara (`91039.mp4`); o vídeo só carrega quando aberto.

**Nota sobre pessoas/acompanhantes:** o campo de preferência de hambúrguer é uma resposta por participante, não uma contagem confiável de lanches de todos os acompanhantes. Os números de pessoas são calculados apenas a partir das respostas **Sim**, não de **Talvez**.

## Fotos usadas

- `302971.jpg`, `302970.jpg`, `302969.jpg` — hambúrgueres/preparo;
- `76107.jpg`, `75086.jpg` — fotos de confraternização da equipe;
- `143240.jpg`, `46938.jpg` — fotos da piscina na chácara;
- `91039.mp4` — vídeo do espaço da chácara.

A fotografia da criança (`1751.jpg`) e o vídeo esportivo (`60592.mp4`) não foram colocados na galeria, por não terem correspondência evidente com a festa e para não expor uma criança publicamente sem necessidade. Nenhuma das fotos publicadas foi recriada ou substituída por IA.

## Metadados do WhatsApp

O `index.html` contém título e descrição Open Graph. **Para garantir que o WhatsApp exiba uma foto no cartão de prévia**, a propriedade `og:image` precisa conter uma URL **HTTPS absoluta** e pública, conforme a URL final do seu GitHub Pages/domínio; o pacote usa um caminho relativo como referência até essa URL ser confirmada. O arquivo de imagem já está incluído em `assets/fotos/302971.jpg`. No WhatsApp, o compartilhamento por texto + link funciona independentemente da prévia.

## O que foi alterado

1. Nova página de Halloween substitui a capa AMICC **somente nos arquivos do novo deploy**, sem apagar dados antigos.
2. Configuração Firebase original preservada e nova árvore de dados exclusiva do Halloween.
3. Resposta única editável por navegador, com sincronização em tempo real.
4. Galeria integrada com fotos reais e vídeo da chácara; visual responsivo, escuro e laranja.
5. Estatísticas por presença, opção de piscina, cardápio e contribuição.
6. Exportação PDF, WhatsApp, pesquisa, filtros e organizador.
7. Ícones, manifesto e service worker para instalação como PWA.

## Testes recomendados antes do envio ao grupo

1. Abrir no Android e no computador; verificar imagens, link e rolagem.
2. Enviar um `Sim` com duas pessoas; conferir contadores em outro dispositivo simultaneamente.
3. Atualizar no mesmo navegador para `Talvez`; conferir recálculo.
4. Enviar um `Não`; conferir se não soma no número de convidados.
5. Abrir organizador, editar horário/local; conferir sincronização em outro dispositivo.
6. Baixar PDF e abrir no Android; conferir dados e páginas.
7. Clicar no botão WhatsApp e verificar texto e URL.
8. Testar regras de exclusão; confirmar que os registros antigos da AMICC continuam na nuvem.

**Powered by thIAguinho Soluções Digitais**
