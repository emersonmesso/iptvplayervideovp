# Funcionalidade de Detalhes da Série

## Visão Geral

Implementada uma funcionalidade completa para visualizar detalhes de séries em uma tela dedicada com informações organizadas, navegação entre temporadas e reprodução de episódios.

## Funcionalidades Implementadas

### 1. Tela de Detalhes da Série
- **Nova Tela**: `#series-details-screen` criada no HTML
- **Layout de Página Completa**: Layout responsivo em duas colunas (informações da série + temporadas/episódios)
- **Design Moderno**: Cards com backdrop blur, gradientes, sombras e animações suaves
- **Navegação Dedicada**: Navbar própria com botão "Voltar às Séries"

### 2. Informações da Série
- **Poster da Série**: Exibição da imagem de capa com lazy loading
- **Informações Básicas**:
  - Nome da série
  - Ano de lançamento
  - Avaliação (estrelas)
  - Número total de temporadas
  - Número total de episódios
  - Sinopse/descrição

### 3. Navegação entre Temporadas
- **Seletor de Temporadas**: Botões dinâmicos para cada temporada
- **Indicador de Episódios**: Mostra quantos episódios há em cada temporada
- **Estado Ativo**: Temporada selecionada fica destacada

### 4. Lista de Episódios
- **Organização por Temporada**: Episódios organizados e numerados
- **Informações do Episódio**:
  - Número do episódio
  - Título
  - Sinopse (limitada a 150 caracteres)
  - Duração (se disponível)
  - Avaliação (se disponível)
  - Data de lançamento (se disponível)
- **Botão de Reprodução**: Cada episódio tem seu botão "Assistir"

### 5. Funcionalidades JavaScript

#### `showSeriesDetailsScreen(serieInfo, serie)`
- Processa informações da série
- Popula a tela com dados
- Organiza temporadas e episódios
- Navega para a tela de detalhes

#### `processSeriesSeasons(serieInfo)`
- Processa dados brutos da API Xtream
- Organiza episódios por temporada
- Ordena temporadas e episódios numericamente
- Retorna estrutura organizada

#### `createSeasonsSelector(seasons)`
- Cria botões dinâmicos para cada temporada
- Adiciona eventos de clique
- Gerencia estado ativo

#### `showSeasonEpisodes(season, seasonIndex)`
- Exibe episódios da temporada selecionada
- Cria interface de episódios
- Adiciona botões de reprodução

### 6. Estilos CSS Específicos

#### Design da Tela
```css
.series-info-card {
    background: rgba(0, 0, 0, 0.4) !important;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

#series-poster {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border-radius: 8px;
}
```

#### Seletor de Temporadas
```css
#seasons-selector .btn.active {
    background: #ffc107;
    color: #000;
    font-weight: bold;
    box-shadow: 0 4px 15px rgba(255, 193, 7, 0.3);
}
```

#### Lista de Episódios
```css
.episode-item:hover {
    background: rgba(255, 193, 7, 0.1);
    border-color: #ffc107 !important;
    transform: translateX(5px);
}
```

## Como Usar

### Para o Usuário
1. **Acesse a seção de Séries** no menu lateral
2. **Clique em uma categoria** de séries (se usando Xtream)
3. **Clique em uma série** da lista
4. **Visualize as informações** completas na nova tela que abre
5. **Navegue entre temporadas** clicando nos botões de temporada
6. **Assista episódios** clicando no botão "Assistir" de cada episódio
7. **Volte à lista** clicando em "Voltar às Séries" na navbar

### Fluxo de Funcionamento
1. Usuário clica em uma série
2. Sistema chama `showSerieEpisodes(serie)`
3. API Xtream é consultada com `get_series_info`
4. Dados são processados e organizados
5. Nova tela é exibida com informações completas
6. Usuário pode navegar e assistir episódios
7. Usuário pode voltar à lista usando `goBackToSeriesList()`

## Estrutura de Dados

### Entrada da API Xtream
```javascript
{
  info: { plot: "Sinopse da série" },
  seasons: {
    "1": {
      "1": {
        id: "12345",
        season_number: "1",
        episode_num: "1",
        title: "Piloto",
        plot: "Primeiro episódio",
        container_extension: "mp4"
      }
    }
  }
}
```

### Estrutura Processada
```javascript
{
  number: 1,
  name: "Temporada 1",
  episodes: [
    {
      id: "12345",
      number: 1,
      title: "Piloto",
      plot: "Primeiro episódio",
      url: "http://server/series/user/pass/12345.mp4"
    }
  ]
}
```

## Responsividade

### Desktop (>= 992px)
- Layout de duas colunas (4:8)
- Card de informações da série à esquerda
- Seção de temporadas e episódios à direita
- Lista de episódios com scroll personalizado

### Mobile (< 992px)
- Layout de uma coluna
- Card de informações da série no topo
- Temporadas centralizadas
- Episódios em lista vertical com altura limitada

### Mobile (< 768px)
- Padding reduzido para melhor aproveitamento do espaço
- Poster da série com altura limitada (300px)
- Botões e elementos menores para touch

## Melhorias Futuras Possíveis

1. **Favoritos por Episódio**: Marcar episódios específicos como favoritos
2. **Histórico de Visualização**: Rastrear progresso por episódio
3. **Download de Episódios**: Funcionalidade de download offline
4. **Legendas**: Suporte a múltiplas legendas
5. **Qualidade de Vídeo**: Seleção de qualidade por episódio
6. **Busca dentro da Série**: Buscar episódios específicos
7. **Recomendações**: Séries similares baseadas na série atual

## Compatibilidade

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers
- ✅ Xtream Codes API
- ✅ Bootstrap 5.3.2
- ✅ Font Awesome 6.0