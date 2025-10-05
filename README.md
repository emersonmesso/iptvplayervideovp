# IPTV Player Video VP

Um player web completo para reprodução de streams IPTV com suporte a listas M3U e servidores Xtream Codes.

## 🚀 Funcionalidades

### ✨ Principais Recursos
- **Múltiplos tipos de conexão**: Suporte a listas M3U e servidores Xtream Codes
- **Reprodução de vídeo avançada**: Player HLS.js para streams M3U8
- **Interface responsiva**: Design moderno e adaptável para todos os dispositivos
- **EPG (Guia de Programação)**: Visualização de programação dos canais
- **Busca inteligente**: Pesquisa em tempo real por canais, filmes e séries
- **Armazenamento local**: Salva configurações de conexão para uso posterior

### 📺 Tipos de Conteúdo Suportados
- **Canais ao vivo**: Streams de TV em tempo real
- **Filmes**: Catálogo completo de filmes on-demand
- **Séries**: Episódios organizados por temporada
- **EPG**: Programação detalhada dos canais

### 🔧 Funcionalidades Técnicas
- **Player HLS nativo**: Reprodução otimizada de streams M3U8
- **Fallback para CORS**: Sistema de proxy para contornar limitações de CORS
- **Cache inteligente**: Armazenamento local dos dados para acesso rápido
- **Interface modal**: Player em tela cheia com controles avançados
- **Indicadores visuais**: Status ao vivo, classificações e informações detalhadas

## 🛠️ Tecnologias Utilizadas

- **HTML5**: Estrutura semântica moderna
- **CSS3**: Animações, gradientes e design responsivo
- **JavaScript ES6+**: Programação orientada a objetos
- **HLS.js**: Biblioteca para reprodução de streams HLS
- **Font Awesome**: Ícones vetoriais
- **Local Storage**: Persistência de dados no navegador

## 📱 Interface do Usuário

### Tela Inicial
- Seleção do tipo de conexão (M3U ou Xtream Codes)
- Design atrativo com cards interativos

### Formulários de Conexão
- **M3U**: URL da lista e EPG opcional
- **Xtream Codes**: Servidor, usuário e senha
- Validação em tempo real

### Tela Principal
- **Sidebar navegável**: Canais, Filmes, Séries, EPG
- **Área de conteúdo**: Grid responsivo com informações detalhadas
- **Busca avançada**: Filtros por nome e categoria
- **Header funcional**: Atualizar conteúdo e desconectar

### Player Modal
- **Reprodução em tela cheia**: Interface limpa e funcional
- **Informações do programa**: EPG em tempo real
- **Controles nativos**: Play, pause, volume, fullscreen

## 🚀 Como Usar

1. **Acesse a aplicação**: Abra o arquivo `index.html` em seu navegador
2. **Escolha o tipo de conexão**:
   - **Lista M3U**: Informe a URL da sua lista M3U
   - **Servidor Xtream**: Insira os dados do servidor
3. **Aguarde o carregamento**: O sistema verificará a conexão e baixará o conteúdo
4. **Navegue pelo conteúdo**: Use a sidebar para alternar entre seções
5. **Reproduza o conteúdo**: Clique em qualquer item para iniciar a reprodução

## 📋 Estrutura do Projeto

```
iptvplayervideovp/
├── index.html          # Estrutura principal da aplicação
├── styles.css          # Estilos e design responsivo
├── script.js           # Lógica da aplicação e player
└── README.md          # Documentação do projeto
```

## 🔧 Configuração

### Requisitos
- Navegador moderno com suporte a HTML5 e JavaScript ES6+
- Conexão com a internet para carregar bibliotecas CDN
- Acesso aos servidores IPTV (pode necessitar configuração de CORS)

### CORS e Proxies
Para desenvolvimento, a aplicação tenta contornar limitações de CORS usando:
1. Requisições diretas (quando permitido pelo servidor)
2. Proxy CORS como fallback (cors-anywhere.herokuapp.com)

**Nota**: Para produção, configure adequadamente as políticas CORS no servidor ou use um proxy próprio.

## 🎯 Funcionalidades Detalhadas

### Sistema de Conexão M3U
- Parse completo de listas M3U/M3U8
- Extração de metadados (nome, logo, categoria, EPG ID)
- Suporte a EPG em formato XML
- Validação de URLs e conteúdo

### Sistema Xtream Codes
- Autenticação com servidor
- Carregamento de categorias (canais, filmes, séries)
- Informações detalhadas de conteúdo
- EPG integrado do servidor
- Suporte a episódios de séries

### Player HLS Avançado
- Reprodução adaptativa de qualidade
- Buffer inteligente para streaming
- Tratamento de erros e reconexão
- Suporte a legendas e múltiplas faixas de áudio
- Controles personalizados

### EPG (Electronic Program Guide)
- Programação por data
- Indicação de programa atual
- Informações detalhadas dos programas
- Navegação por canal
- Integração com player

## 🎨 Design e UX

### Tema Visual
- **Paleta de cores**: Azul profundo com acentos dourados
- **Tipografia**: Segoe UI para legibilidade
- **Efeitos**: Glassmorphism e animações suaves
- **Responsividade**: Adaptação completa para mobile

### Experiência do Usuário
- **Navegação intuitiva**: Fluxo lógico e claro
- **Feedback visual**: Loading, hover effects, status
- **Acessibilidade**: Contraste adequado e navegação por teclado
- **Performance**: Carregamento otimizado e cache inteligente

## 🛡️ Considerações de Segurança

- **Validação de entrada**: Sanitização de URLs e dados
- **Armazenamento seguro**: Dados sensíveis em localStorage
- **Tratamento de erros**: Mensagens adequadas ao usuário
- **CORS**: Configuração adequada para produção

## 🔄 Atualizações Futuras

### Planejado
- [ ] Suporte a mais formatos de stream
- [ ] Player com controles avançados
- [ ] Sistema de favoritos
- [ ] Histórico de reprodução
- [ ] Configurações de qualidade
- [ ] Suporte offline
- [ ] API própria para proxy
- [ ] Sistema de usuários
- [ ] Playlists personalizadas
- [ ] Chromecast integration

## 📞 Suporte

Para dúvidas, problemas ou sugestões:
- Verifique a documentação completa
- Teste com diferentes navegadores
- Confirme a conectividade com os servidores IPTV
- Verifique as configurações de CORS

## 📄 Licença

Este projeto é uma demonstração educacional. Use responsavelmente e respeite os direitos autorais do conteúdo acessado.

---

**IPTV Player Video VP** - Desenvolvido com ❤️ para a comunidade IPTV
