# IPTV Player Web

U### 💾 Gerenciamento
- ✅ **Sistema de Favoritos**: Salve e gerencie suas listas favoritas
- ✅ **Conexões Recentes**: Histórico das últimas 5 conexões na tela inicial
- ✅ **Persistência Local**: localStorage para salvar conexões
- ✅ **Reconexão Rápida**: Clique para reconectar instantaneamenteprodutor de IPTV completo baseado em navegador com suporte para listas M3U e servidores Xtream Codes.

## ✨ Funcionalidades

### 🎯 Reprodução de Mídia
- ✅ **Suporte a M3U8**: Reprodução de streams M3U8 com HLS.js
- ✅ **Suporte a Xtream Codes**: Integração completa com servidores Xtream
- ✅ **Player Avançado**: Player com Plyr.js para melhor experiência
- ✅ **Controles Completos**: Fullscreen, recarregar vídeo e fechar player
- ✅ **EPG**: Suporte a guia eletrônica de programação

### 🎨 Interface
- ✅ **Interface Moderna**: Bootstrap 5 com design glassmorphism
- ✅ **Alertas Elegantes**: SweetAlert2 para notificações
- ✅ **Responsivo**: Funciona perfeitamente em desktop, tablet e mobile
- ✅ **Navegação por Categorias**: Canais, Filmes e Séries organizados
- ✅ **Tema Escuro**: Visual moderno com gradientes

### � Gerenciamento
- ✅ **Sistema de Favoritos**: Salve e gerencie suas listas favoritas
- ✅ **Persistência Local**: localStorage para salvar conexões
- ✅ **Histórico**: Acesso rápido às listas utilizadas

### 📱 Experiência do Usuário
- ✅ **Sidebar Fixa**: Navegação sempre visível nas categorias
- ✅ **Carregamento Dinâmico**: APIs carregadas sob demanda
- ✅ **Busca e Filtros**: Navegação intuitiva por categorias
- ✅ **Indicadores Visuais**: Status de conexão e carregamento
- ✅ **Multi-formato**: Suporte a diversos formatos de vídeo

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Framework CSS**: Bootstrap 5.3.2
- **Player**: HLS.js + Plyr.js para reprodução avançada
- **UI/UX**: SweetAlert2, Font Awesome
- **Storage**: localStorage para persistência

## 📖 Como Usar

### Primeira Conexão
1. Abra o arquivo `index.html` em um navegador moderno
2. Na tela inicial, veja suas **Conexões Recentes** (se houver)
3. Para nova conexão, escolha entre **M3U** ou **Xtream Codes**
4. Configure sua conexão:
   - **M3U**: Cole a URL da lista ou faça upload do arquivo
   - **Xtream**: Insira servidor, usuário e senha

### Navegação
5. Use a **sidebar fixa** para navegar entre categorias
6. Explore as categorias disponíveis no conteúdo principal
7. Clique em qualquer conteúdo para reproduzir em player fullscreen
8. Use os controles do player:
   - **🔄 Recarregar**: Reinicia o vídeo atual
   - **⛶ Fullscreen**: Alterna modo tela cheia
   - **✕ Fechar**: Fecha o player

### Sistema de Favoritos
9. Clique em **"💖 Favoritos"** no menu superior
10. Salve sua conexão atual com **"Salvar Lista Atual"**
11. Acesse rapidamente suas listas salvas

### Conexões Recentes
- Na tela inicial, veja suas últimas 5 conexões
- Clique em qualquer conexão para reconectar instantaneamente
- Histórico salvo automaticamente a cada nova conexão

## � Estrutura de Arquivos

```
/workspaces/iptvplayervideovp/
├── index.html      # Interface principal com modais e componentes
├── script.js       # Lógica completa da aplicação
├── styles.css      # Estilos customizados e temas
└── README.md       # Documentação completa
```

## 🎮 Funcionalidades por Tipo de Conteúdo

### 📺 Canais ao Vivo
- Player em modal fullscreen otimizado
- Indicador "AO VIVO" em tempo real
- EPG com programação atual e próxima
- Controles avançados: fullscreen, recarregar, fechar

### 🎬 Filmes
- Reprodução em modal tela cheia
- Informações de classificação e ano
- Sinopse e detalhes do filme

### 📺 Séries
- Navegação por temporadas e episódios
- Lista de episódios organizada
- Informações detalhadas de cada episódio

## 🔧 Compatibilidade

### Navegadores Suportados
- **Chrome/Chromium** 60+
- **Firefox** 55+
- **Safari** 11+
- **Edge** 79+

### Dispositivos
- **Desktop**: Experiência completa com player fullscreen
- **Tablet**: Interface adaptativa com controles otimizados
- **Mobile**: Player responsivo com controles touch-friendly

## ⚡ Funcionalidades Técnicas

### Conectividade
- Parser M3U nativo otimizado
- API Xtream Codes completa
- CORS handling automático
- Fallback para diferentes formatos

### Performance
- Carregamento lazy de categorias
- Cache inteligente de dados
- Otimização de memória no player
- Compressão de dados locais

### Segurança
- Validação de URLs e dados
- Sanitização de inputs
- Tratamento seguro de erros
- Storage criptografado

## � Melhorias Futuras

- [ ] Suporte a legendas automáticas
- [ ] Sistema de busca global
- [ ] Exportação/importação de favoritos
- [ ] Modo offline para conteúdo local
- [ ] Integração com serviços de streaming

## 🎯 Uso Recomendado

1. **Para Listas M3U**: Ideal para listas estáticas e conteúdo local
2. **Para Xtream Codes**: Perfeito para provedores IPTV profissionais
3. **Player Fullscreen**: Experiência imersiva com controles avançados
4. **Sistema de Favoritos**: Organize suas fontes de conteúdo favoritas
5. **Controles de Player**: Use recarregar para problemas de conexão

---

*Desenvolvido com foco na experiência do usuário e compatibilidade máxima.*
