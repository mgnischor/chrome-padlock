# Padlock – Gerador de Senhas Seguras

[English](README.md) · **Português (Brasil)** · [Español](README.es-ES.md)

Uma extensão do Chrome (Manifest V3), escrita em TypeScript, que gera senhas aleatórias fortes
inteiramente no seu dispositivo.

## Recursos

- **Aleatoriedade criptograficamente segura** – cada caractere vem de `crypto.getRandomValues`;
  `Math.random` nunca é usado.
- **Sem viés de módulo** – os inteiros aleatórios usam amostragem por rejeição (`src/core/random.ts`).
- **Saída uniforme** – as senhas são sorteadas de forma uniforme entre todas as sequências que contêm
  pelo menos um caractere de cada tipo selecionado (amostragem por rejeição, e não "inserir um de cada
  e embaralhar"), então não há viés de posição.
- **Entropia exata** – o medidor de força mostra a entropia real em bits, calculada por
  inclusão–exclusão sobre os tipos selecionados (`src/core/entropy.ts`).
- **Opções** – tamanho de 4 a 128, minúsculas / maiúsculas / dígitos / símbolos, remoção opcional de
  caracteres parecidos (`0 O 1 l I |`) e uma lista personalizada de caracteres excluídos.
- **Inserir em uma página** – clique com o botão direito em qualquer campo de texto e escolha
  _Inserir senha segura_.
- **Limpeza automática da área de transferência** (opcional) – limpa a área de transferência de 30 s a
  2 min depois de copiar, mas somente se ela ainda contiver a senha copiada.
- **Histórico de senhas** (opcional, desativado por padrão) – quando ativado no popup, um botão
  _Histórico_ mostra as últimas 50 senhas geradas, da mais recente para a mais antiga, cada uma com
  data e hora e um botão para copiar. Veja [Histórico](#histórico) para saber o que é registrado e onde
  fica.
- **Popup espaçoso** que usa os 640 × 400 px completos que um popup de extensão pode ter: a senha e sua
  força à esquerda, todas as opções à direita, sem rolagem na tela do gerador.
- **Localizada em 30 idiomas**, os de mais falantes nativos mais o polonês: inglês, chinês
  (simplificado e tradicional), espanhol, hindi, bengali, português (Brasil), russo, japonês, punjabi,
  marati, telugo, turco, coreano, francês, alemão, vietnamita, tâmil, urdu, javanês, italiano, árabe,
  guzerate, persa, bhojpuri, hauçá, canarim, indonésio, polonês, malaiala e ucraniano. A extensão segue
  automaticamente o idioma do navegador, ou você escolhe outro nas configurações. Árabe, persa e urdu
  espelham o layout (da direita para a esquerda). Veja [Localização](#localização).
- **Teste de força de senha** (botão de escudo, ao lado da engrenagem): digite ou cole qualquer senha
  para ver a entropia estimada em bits, uma classificação de força, avisos sobre padrões fáceis e
  quanto tempo levaria para quebrá-la em quatro tipos de ataque, de um login web com limite de
  tentativas a um ataque offline contra um hash rápido com GPUs. A senha é analisada no seu
  dispositivo, nunca é armazenada nem enviada, e o campo é esvaziado assim que você sai da tela. Veja
  [Teste de força](#teste-de-força).
- **Tela de configurações** (botão de engrenagem): idioma, tema claro / escuro / do sistema, limpeza
  automática da área de transferência, histórico de senhas, item do menu de clique direito e desfoque
  das senhas até passar o mouse. Um botão restaura os padrões.
- **Tela Sobre** (botão do GitHub): versão, autor, licença, declaração de privacidade e um link para o
  [código-fonte no GitHub](https://github.com/mgnischor/chrome-padlock).
- Acessível pelo teclado, sem acesso à rede e sem análise de uso.
- Abra o popup com `Ctrl+Shift+Y` (`Command+Shift+Y` no macOS); altere o atalho em
  `chrome://extensions/shortcuts`.

## Instalação (a partir do código-fonte)

Requer Node.js 20.12 ou mais recente.

```bash
npm install
npm run build
```

Depois abra `chrome://extensions`, ative o **Modo do desenvolvedor**, clique em **Carregar sem
compactação** e selecione a pasta `dist/`.

## Desenvolvimento

| Comando             | Finalidade                                                            |
| ------------------- | --------------------------------------------------------------------- |
| `npm run build`     | Build de produção em `dist/`: JS, HTML, CSS e JSON minificados        |
| `npm run package`   | Compila, verifica e compacta em `release/padlock-<versão>.zip`        |
| `npm run watch`     | Recompila a cada alteração (sem minificar, com source maps embutidos) |
| `npm run typecheck` | Executa `tsc --noEmit` em modo estrito                                |
| `npm test`          | Executa os testes unitários (Vitest)                                  |
| `npm run icons`     | Regenera `public/icons/*.png` (gerador sem dependências)              |
| `npm run check`     | Verifica os tipos, executa os testes e compila                        |

Depois de recompilar, clique no botão de recarregar no card da extensão em `chrome://extensions`.

### Estrutura do projeto

```
public/                 Arquivos estáticos copiados para dist/ (manifest, HTML, CSS, ícones)
src/locales/            Traduções, um arquivo JSON por idioma (en_US é a origem)
scripts/                Ferramentas de build: build, package, minify, zip e gerador de ícones
src/core/               Lógica pura, sem DOM: random, charsets, generator, entropy, teste de força
src/shared/             Configurações, histórico, helper de i18n, tipos de mensagem, helper de hash
src/popup/              Interface do popup
src/background/         Service worker: menu de contexto, timer de limpeza da área de transferência
src/offscreen/          Documento offscreen que limpa a área de transferência
tests/                  Testes unitários Vitest de core/, configurações, histórico e idiomas
```

## Notas de projeto

### Por que amostragem por rejeição para a senha inteira?

A abordagem comum, "escolher um caractere de cada tipo, preencher o resto e embaralhar", produz uma
distribuição que não é uniforme entre as senhas válidas, o que dificulta saber a entropia real. O
Padlock, em vez disso, sorteia cada posição de forma uniforme a partir do conjunto combinado e tenta
de novo se algum tipo selecionado estiver ausente. O resultado é exatamente uniforme entre as
sequências válidas, e a entropia é `log2(N)` com `N` calculado de forma exata. O custo das novas
tentativas é desprezível (cerca de uma tentativa para tamanhos normais; umas cem tentativas baratas no
pior caso, com tamanho 4).

### Permissões

| Permissão                                       | Motivo                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `storage`                                       | Lembrar suas opções e manter o histórico opcional na memória                        |
| `contextMenus`, `scripting`, `activeTab`        | "Inserir senha segura" no campo em que você clica com o botão direito               |
| `alarms`, `offscreen`                           | Timer e documento auxiliar para a limpeza automática da área de transferência       |
| `clipboardRead`, `clipboardWrite` _(opcionais)_ | Solicitadas somente quando você ativa a limpeza automática da área de transferência |

Nenhuma permissão de host é solicitada. `activeTab` só concede acesso à aba em que você aciona o menu
de contexto, para essa única ação.

### Limpeza automática da área de transferência

O popup fecha assim que perde o foco, então o timer roda no service worker. O worker guarda apenas um
hash SHA-256 da senha copiada em `chrome.storage.session` (somente memória, nunca gravado em disco).
Quando o alarme dispara, um documento offscreen lê a área de transferência, compara o hash e a
sobrescreve apenas se forem iguais. O Chrome limita os alarmes a um mínimo de 30 segundos. Se o
usuário copiou outra coisa nesse meio-tempo, a área de transferência não é alterada.

### Histórico

Desativado por padrão. Ative com _Manter um histórico das últimas 50 senhas_ no popup.

- **O que é registrado:** a senha exibida quando o popup abre, depois de _Gerar outra_ e depois que uma
  opção é alterada. Enquanto o controle deslizante é arrastado ou o campo de exclusão é digitado,
  apenas a senha final é registrada, e não cada uma das intermediárias. As senhas inseridas pelo menu
  de contexto também são registradas. Duplicatas consecutivas são ignoradas, e somente as 50 mais
  recentes são mantidas.
- **Onde fica:** `chrome.storage.session`, ou seja, somente na memória do navegador. Nunca é gravado
  em disco e é apagado quando o Chrome fecha. As senhas ficam **sem criptografia** enquanto o Chrome
  está em execução, então quem puder inspecionar a extensão com a sua sessão do navegador aberta
  poderia lê-las.
- **Remoção:** _Limpar histórico_ apaga todas as entradas, e desativar a opção apaga o histórico.
- **Persistência:** para manter o histórico entre reinicializações do navegador, altere `storageArea`
  em `src/shared/history.ts` para `chrome.storage.local`. Isso grava as senhas em texto puro no seu
  perfil, em disco, e é por isso que não é o padrão.

### Privacidade

As senhas são geradas na memória, exibidas no popup e descartadas quando ele fecha, a menos que você
ative o histórico (veja acima). Somente as suas configurações são persistidas (via
`chrome.storage.sync`, portanto acompanham o seu perfil do Chrome): as opções do gerador, o idioma, o
tema e os demais controles. A extensão não faz nenhuma requisição de rede. O único link que ela
contém, para a página do projeto no GitHub na tela Sobre, abre em uma nova aba e só se você clicar nele.

### Localização

O popup e o menu de clique direito são traduzidos para 30 idiomas. Por padrão o idioma segue o idioma
da interface do navegador, e as configurações permitem escolher outro, o que o `chrome.i18n` não
consegue fazer. Por isso as traduções são empacotadas na própria extensão e consultadas por
`src/shared/i18n.ts`, com o mesmo formato de mensagem do Chrome (marcadores `$1` e `$NOME$`). Os
idiomas do navegador são associados à tradução mais próxima: `pt-PT` usa português do Brasil, `es-419`
usa espanhol, `zh-TW`/`zh-HK` usam chinês tradicional, qualquer outro chinês usa o simplificado, e o
resto cai para o inglês.

- **As mensagens** ficam em `src/locales/<código>.json`, no formato do `messages.json` do Chrome. O
  inglês (`en_US`) é a origem; os demais arquivos precisam definir as mesmas chaves e marcadores.
- **Os textos do próprio Chrome** (nome, descrição, dica da barra de ferramentas, descrição do atalho)
  vêm de `_locales`. O build gera essas pastas a partir de `src/locales`, mas só para os 26 idiomas que
  o Chrome suporta. Punjabi, urdu, javanês, bhojpuri e hauçá não existem como idioma da interface do
  Chrome, então a listagem da loja e a página de extensões mostram inglês para eles. A extensão em si
  está totalmente traduzida.
- **O texto do popup** é localizado na inicialização, e de novo sempre que o idioma muda, por
  `applyTranslations`. O HTML mantém o texto em inglês como alternativa e marca os elementos
  traduzíveis com `data-i18n="chave"`, `data-i18n-title`, `data-i18n-aria-label` ou
  `data-i18n-placeholder`. As mensagens montadas no código usam `t("chave", substituições)`. As chaves
  têm os tipos verificados em relação a `en_US.json`, e `src/shared/catalog.ts` é tipado de modo que um
  idioma sem alguma mensagem não compile.
- **O núcleo é neutro quanto ao idioma:** o gerador informa _códigos_ de erro e o módulo de entropia
  informa _níveis_ de força; o popup converte ambos em texto localizado.
- **Idiomas da direita para a esquerda** (árabe, persa, urdu) definem `dir="rtl"` na página. Senhas,
  dicas de caracteres e campos numéricos continuam sempre da esquerda para a direita.
- **As datas** do histórico usam o idioma ativo.
- **Adicionar um idioma:** copie `src/locales/en_US.json` para `src/locales/<código>.json` e traduza
  cada `message` (mantenha os blocos `placeholders` como estão); adicione uma entrada a `LOCALES` em
  `src/shared/locales.ts` (código, nome no próprio idioma, tag do idioma, direção); adicione o import e
  a entrada em `src/shared/catalog.ts`. Se o Chrome suportar o idioma como idioma da interface, inclua
  também o código em `MANIFEST_LOCALES` em `scripts/manifest-locales.mjs`. Os testes então verificam
  que o novo arquivo tem as mesmas chaves e marcadores do inglês, que está traduzido e não é uma cópia,
  que nenhuma mensagem está sem uso e que a descrição respeita o limite de 132 caracteres da Web Store.
- **Testar um idioma:** escolha-o nas configurações, ou inicie o Chrome com `--lang=pt-BR` para testar
  a escolha automática.

### Teste de força

O teste funciona com qualquer senha, e não só com as que o Padlock cria, então não pode supor que a
senha seja aleatória. `analyzePassword` (`src/core/strength.ts`) divide a senha em partes e dá a cada
uma um preço em bits de esforço de adivinhação, do jeito que um atacante tentaria, e fica com a divisão
mais barata:

| Parte                                                | Preço                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| Uma senha ou palavra comum (cerca de 160 embutidas)  | `log2(posição)`, mais um bit para maiúsculas ou trocas (`P@ssw0rd`) |
| Uma repetição (`aaaa`, `abcabc`)                     | a unidade repetida, mais `log2(vezes)`                        |
| Uma sequência (`abcd`, `4321`) ou trecho de teclado (`asdf`) | um ponto de partida mais `log2(tamanho)`              |
| Um ano de 1900 a 2039                                | cerca de 8 bits                                               |
| Qualquer outra coisa                                 | `log2(conjunto)` por caractere, sendo o conjunto os tipos de caractere usados |

Para uma senha aleatória isso dá `tamanho × log2(conjunto)`; para uma senha escolhida por uma pessoa é
menos, muitas vezes bem menos. O tempo de quebra é a média, que é metade de todas as tentativas,
`2^(bits − 1)`, dividida pela velocidade do atacante. As quatro velocidades são as do estimador
zxcvbn: 100 por hora (login web com limite), 10 por segundo (login web sem limite), 10 mil por segundo
(ataque offline contra um hash lento como o bcrypt) e 10 bilhões por segundo (ataque offline contra
um hash rápido como o MD5, com GPUs). As durações são escritas por `Intl.NumberFormat`
(`src/shared/format.ts`), então unidades e plurais vêm dos dados de localidade do navegador em todos os
idiomas.

Limites, que a própria tela também informa: é uma **estimativa**. Ela conhece só os padrões acima e uma
lista curta de senhas comuns, então uma senha feita de palavras comuns (uma frase como "correct horse
battery staple") recebe uma nota maior do que merece, porque não há dicionário. Ela não sabe se uma
senha já apareceu em um vazamento. "Muito forte" significa, portanto, "nenhum padrão fácil
encontrado", e não "segura para usar": use uma senha que ninguém nunca viu, como as que o Padlock
gera.

A senha digitada nunca sai da página: não é armazenada, não vai em mensagens, não entra no histórico e
não é registrada, e o campo é esvaziado ao sair da tela ou ao pressionar Esc.

### Aparência e configurações

A configuração de tema é _Padrão do sistema_, _Claro_ ou _Escuro_. Ela é aplicada por meio de um
atributo `data-theme` na página, então as cores são variáveis CSS comuns em `public/popup.css`. O
popup fica oculto até que o idioma e o tema salvos sejam aplicados, para que nenhum dos dois pisque ao
abrir. As configurações são validadas ao serem lidas (`sanitizeSettings`), então um idioma ou tema
desconhecido no armazenamento volta ao padrão em vez de quebrar o popup.

### Documentação do código

Toda função é documentada com [TSDoc](https://tsdoc.org): um resumo de uma linha, seguido de
`@param nome - descrição`, `@returns` e `@throws` quando aplicável. Os tipos não são repetidos nas
tags porque o TypeScript já os fornece.

### Build e empacotamento

`npm run build` sempre gera o build de produção, que é o que vai para o usuário. Somente
`npm run watch` não minifica, para que os erros apontem para código legível.

| Tipo de arquivo                | Como é minificado                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript → JavaScript        | esbuild: empacotado, minificado, sem source maps, comentários de licença removidos                                                            |
| `popup.css`                    | minificador de CSS do esbuild                                                                                                                 |
| `popup.html`, `offscreen.html` | `scripts/minify.mjs`: comentários removidos e espaços reduzidos; atributos entre aspas e o conteúdo de `<script>`/`<textarea>` ficam intactos |
| `manifest.json`                | JSON compacto, com a versão tirada de `package.json`                                                                                          |
| `src/locales/*.json`           | Empacotados no JavaScript sem as notas `description` e `example`, que servem só aos tradutores, em UTF-8 e não em escapes `\u`               |
| `_locales/*/messages.json`     | Gerados: só as cinco mensagens do manifest, JSON compacto, para os 26 idiomas que o Chrome suporta                                            |
| Ícones                         | Copiados como estão                                                                                                                           |

Em seguida, `npm run package` verifica o build e grava o arquivo para envio à Web Store em
`release/padlock-<versão>.zip` (reproduzível: as mesmas fontes geram os mesmos bytes). Ele para com
erro se o manifest referenciar um arquivo inexistente, se source maps ou outros arquivos de
desenvolvimento entrarem no pacote, se uma página HTML tiver script inline ou se o JavaScript
empacotado contiver `fetch`, `XMLHttpRequest`, `WebSocket`, `eval`, `new Function` ou uma URL
`http(s)://`.

### Segurança

- **Sem rede, por construção.** A política de segurança de conteúdo bloqueia toda requisição
  (`connect-src 'none'`), plugins, mudanças da URL base e envios de formulário, e permite apenas
  scripts empacotados com a extensão. A verificação do pacote acima rejeita código de rede e `eval`.
- **Sem acesso a sites.** O manifest não declara permissões de host, content scripts nem recursos
  acessíveis pela web. `activeTab` dá acesso a uma única aba, somente depois que o usuário clica no
  item do menu de contexto.
- **Tratamento rigoroso de mensagens.** O service worker aceita mensagens de runtime apenas desta
  extensão e valida o formato, o formato do hash e o atraso em relação aos valores oferecidos pela
  interface.
- **Segredos somente na memória.** O histórico e o hash da área de transferência ficam em
  `chrome.storage.session`, limitado a contextos confiáveis da extensão e nunca gravado em disco.
- **Atualizações seguras do DOM.** O código nunca usa `innerHTML`; o texto entra com `textContent`.
- **Testes de proteção.** `tests/manifest.test.ts` falha se uma permissão for adicionada sem a
  justificativa correspondente em `docs/chrome-web-store.md`, ou se o manifest ganhar acesso a sites
  ou uma política mais fraca.
- **Dependências.** `npm audit` não relata vulnerabilidades conhecidas, e a extensão não leva
  dependências de runtime: tudo o que é empacotado é código deste repositório.

### Publicação

Estes documentos estão em inglês, o idioma usado pela Chrome Web Store.

- [docs/privacy-policy.md](docs/privacy-policy.md): a política de privacidade. A loja exige que ela
  esteja em uma URL pública. Atualize-a antes de lançar qualquer mudança no que a extensão armazena
  ou transmite.
- [store-listing/](store-listing): a descrição da loja, pronta para colar, nos 26 idiomas que a loja
  aceita para a listagem (um `<código>.txt` por idioma). Cada texto segue as regras de listagem da
  loja: sem emojis nem símbolos decorativos, sem repetir uma palavra-chave mais de cinco vezes, só com
  afirmações que correspondem ao que a extensão faz e sem links além do repositório do projeto. O
  `tests/store-listing.test.ts` verifica tudo isso, então edite os textos e rode `npm test` antes de
  colar um texto alterado.

## Limitações

- Somente senhas de caracteres aleatórios; não há modo de frase secreta (passphrase).
- "Inserir senha segura" preenche apenas o campo em foco. Não preenche um campo de "confirmar senha";
  copie a senha e cole nele.
- A extensão não é um gerenciador de senhas. O histórico opcional é uma conveniência de curta duração,
  e não um armazenamento; guarde as senhas importantes em um gerenciador de senhas.
