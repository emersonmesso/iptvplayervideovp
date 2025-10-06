class IPTVPlayer {
    constructor() {
        this.connectionType = null;
        this.connectionData = null;
        this.channels = [];
        this.movies = [];
        this.series = [];
        this.epgData = {};
        this.currentPlayer = null;
        this.currentSection = 'channels';
        
        // Xtream categories for on-demand loading
        this.channelCategories = [];
        this.movieCategories = [];
        this.seriesCategories = [];
        
        // Current category tracking
        this.currentChannelCategory = null;
        this.currentMovieCategory = null;
        this.currentSeriesCategory = null;
        
        // Favorites system
        this.favorites = [];
        
        // Recent connections
        this.recentConnections = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadStoredConnection();
        this.loadFavorites();
        this.loadRecentConnections();
        
        // Ensure only connection-selector is shown initially
        this.showScreen('connection-selector');
        
        // Debug: log initial screen states
        console.log('Initial screen states:');
        document.querySelectorAll('.screen').forEach(screen => {
            console.log(`${screen.id}: active=${screen.classList.contains('active')}, display=${getComputedStyle(screen).display}`);
        });
    }

    setupEventListeners() {
        // Form submissions
        document.getElementById('m3u-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.connectM3U();
        });
        
        // Fullscreen change event
        document.addEventListener('fullscreenchange', () => {
            const icon = document.getElementById('fullscreen-icon');
            if (icon) {
                if (document.fullscreenElement) {
                    icon.className = 'fas fa-compress';
                } else {
                    icon.className = 'fas fa-expand';
                }
            }
        });

        document.getElementById('xtream-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.connectXtream();
        });

        // Search functionality
        document.getElementById('channels-search').addEventListener('input', (e) => {
            this.filterContent('channels', e.target.value);
        });

        document.getElementById('movies-search').addEventListener('input', (e) => {
            this.filterContent('movies', e.target.value);
        });

        document.getElementById('series-search').addEventListener('input', (e) => {
            this.filterContent('series', e.target.value);
        });

        // EPG date change
        document.getElementById('epg-date').addEventListener('change', () => {
            this.loadEPG();
        });

        // Set today's date for EPG
        document.getElementById('epg-date').valueAsDate = new Date();
    }

    async loadStoredConnection() {
        const stored = localStorage.getItem('iptv-connection');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.connectionType = data.type;
                this.connectionData = data.data;
                this.showScreen('main-screen');
                
                if (this.connectionType === 'xtream') {
                    await this.loadXtreamCategories();
                    this.displayInitialContent();
                } else {
                    this.loadContent();
                }
            } catch (error) {
                console.error('Error loading stored connection:', error);
                // If error, show connection selector
                this.showScreen('connection-selector');
            }
        }
    }

    selectConnectionType(type) {
        console.log('Selecting connection type:', type);
        this.connectionType = type;
        if (type === 'm3u') {
            console.log('Showing M3U login screen');
            this.showScreen('m3u-login');
        } else if (type === 'xtream') {
            console.log('Showing Xtream login screen');
            this.showScreen('xtream-login');
        }
    }

    async connectM3U() {
        const url = document.getElementById('m3u-url').value;
        const epgUrl = document.getElementById('m3u-epg').value;

        this.showLoading(true);

        try {
            const response = await this.fetchWithCORS(url);
            const m3uContent = await response.text();
            
            this.connectionData = {
                url: url,
                epgUrl: epgUrl,
                content: m3uContent
            };

            this.parseM3U(m3uContent);
            
            if (epgUrl) {
                await this.loadEPGFromURL(epgUrl);
            }

            this.saveConnection();
            this.saveRecentConnection(this.connectionData, 'm3u');
            this.showScreen('main-screen');
            this.displayContent();

        } catch (error) {
            console.error('Error connecting to M3U:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro de Conexão',
                text: 'Erro ao conectar com a lista M3U. Verifique a URL e tente novamente.',
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700'
            });
        } finally {
            this.showLoading(false);
        }
    }

    async connectXtream() {
        const url = document.getElementById('xtream-url').value;
        const username = document.getElementById('xtream-username').value;
        const password = document.getElementById('xtream-password').value;

        this.showLoading(true);

        try {
            // Test authentication
            const authUrl = `${url}/player_api.php?username=${username}&password=${password}`;
            const authResponse = await this.fetchWithCORS(authUrl);
            const authData = await authResponse.json();

            if (authData.user_info && authData.user_info.auth === 1) {
                this.connectionData = {
                    url: url,
                    username: username,
                    password: password
                };

                // Load only categories, not all content
                await this.loadXtreamCategories();
                this.saveConnection();
                this.saveRecentConnection(this.connectionData, 'xtream');
                this.showScreen('main-screen');
                
                // Initialize with empty content - will load on demand
                this.displayInitialContent();
            } else {
                throw new Error('Authentication failed');
            }

        } catch (error) {
            console.error('Error connecting to Xtream:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro de Autenticação',
                text: 'Erro ao conectar com o servidor. Verifique os dados e tente novamente.',
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700'
            });
        } finally {
            this.showLoading(false);
        }
    }

    async loadXtreamCategories() {
        const { url, username, password } = this.connectionData;
        const baseUrl = `${url}/player_api.php?username=${username}&password=${password}`;

        try {
            // Load categories only, not the streams
            const [channelCategoriesResponse, movieCategoriesResponse, seriesCategoriesResponse] = await Promise.all([
                this.fetchWithCORS(`${baseUrl}&action=get_live_categories`),
                this.fetchWithCORS(`${baseUrl}&action=get_vod_categories`),
                this.fetchWithCORS(`${baseUrl}&action=get_series_categories`)
            ]);

            this.channelCategories = await channelCategoriesResponse.json();
            this.movieCategories = await movieCategoriesResponse.json();
            this.seriesCategories = await seriesCategoriesResponse.json();

            // Initialize empty arrays - content will be loaded on demand
            this.channels = [];
            this.movies = [];
            this.series = [];
            this.epgData = {};

            console.log('Categories loaded successfully');
        } catch (error) {
            console.error('Error loading categories:', error);
            throw error;
        }
    }

    async loadChannelsByCategory(categoryId) {
        const { url, username, password } = this.connectionData;
        const baseUrl = `${url}/player_api.php?username=${username}&password=${password}`;

        this.showLoadingMessage('channels-list', 'Carregando canais...');

        try {
            const response = await this.fetchWithCORS(`${baseUrl}&action=get_live_streams&category_id=${categoryId}`);
            const streams = await response.json();

            this.channels = streams.map(stream => ({
                name: stream.name,
                url: `${url}/live/${username}/${password}/${stream.stream_id}.m3u8`,
                logo: stream.stream_icon,
                category: this.currentChannelCategory.category_name,
                epg_channel_id: stream.epg_channel_id
            }));

            return this.channels;

        } catch (error) {
            console.error('Error loading channels:', error);
            this.channels = [];
            return [];
        }
    }

    async loadMoviesByCategory(categoryId) {
        const { url, username, password } = this.connectionData;
        const baseUrl = `${url}/player_api.php?username=${username}&password=${password}`;

        this.showLoadingMessage('movies-list', 'Carregando filmes...');

        try {
            const response = await this.fetchWithCORS(`${baseUrl}&action=get_vod_streams&category_id=${categoryId}`);
            const movies = await response.json();

            this.movies = movies.map(movie => ({
                name: movie.name,
                url: `${url}/movie/${username}/${password}/${movie.stream_id}.${movie.container_extension}`,
                logo: movie.stream_icon,
                category: this.currentMovieCategory.category_name,
                plot: movie.plot,
                year: movie.year,
                rating: movie.rating_5based
            }));

            return this.movies;

        } catch (error) {
            console.error('Error loading movies:', error);
            this.movies = [];
            return [];
        }
    }

    async loadSeriesByCategory(categoryId) {
        const { url, username, password } = this.connectionData;
        const baseUrl = `${url}/player_api.php?username=${username}&password=${password}`;

        this.showLoadingMessage('series-list', 'Carregando séries...');

        try {
            const response = await this.fetchWithCORS(`${baseUrl}&action=get_series&category_id=${categoryId}`);
            const series = await response.json();

            this.series = series.map(serie => ({
                name: serie.name,
                logo: serie.cover,
                category: this.currentSeriesCategory.category_name,
                plot: serie.plot,
                year: serie.year,
                rating: serie.rating_5based,
                series_id: serie.series_id
            }));

            return this.series;

        } catch (error) {
            console.error('Error loading series:', error);
            this.series = [];
            return [];
        }
    }

    parseM3U(content) {
        const lines = content.split('\n');
        this.channels = [];
        
        let currentChannel = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('#EXTINF:')) {
                currentChannel = {};
                
                // Extract channel name
                const nameMatch = line.match(/,(.+)$/);
                if (nameMatch) {
                    currentChannel.name = nameMatch[1].trim();
                }
                
                // Extract logo
                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                if (logoMatch) {
                    currentChannel.logo = logoMatch[1];
                }
                
                // Extract group/category
                const groupMatch = line.match(/group-title="([^"]+)"/);
                if (groupMatch) {
                    currentChannel.category = groupMatch[1];
                }
                
                // Extract EPG channel ID
                const epgMatch = line.match(/tvg-id="([^"]+)"/);
                if (epgMatch) {
                    currentChannel.epg_channel_id = epgMatch[1];
                }
                
            } else if (line && !line.startsWith('#') && currentChannel) {
                currentChannel.url = line;
                this.channels.push(currentChannel);
                currentChannel = null;
            }
        }
    }

    async loadEPGFromURL(epgUrl) {
        try {
            const response = await this.fetchWithCORS(epgUrl);
            const xmlText = await response.text();
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            
            this.parseEPGXML(xmlDoc);
        } catch (error) {
            console.error('Error loading EPG:', error);
        }
    }

    parseEPGXML(xmlDoc) {
        const programmes = xmlDoc.getElementsByTagName('programme');
        this.epgData = {};
        
        for (let programme of programmes) {
            const channel = programme.getAttribute('channel');
            const start = programme.getAttribute('start');
            const stop = programme.getAttribute('stop');
            
            const titleElement = programme.getElementsByTagName('title')[0];
            const descElement = programme.getElementsByTagName('desc')[0];
            
            const title = titleElement ? titleElement.textContent : '';
            const desc = descElement ? descElement.textContent : '';
            
            if (!this.epgData[channel]) {
                this.epgData[channel] = [];
            }
            
            this.epgData[channel].push({
                title,
                desc,
                start: this.parseEPGTime(start),
                stop: this.parseEPGTime(stop)
            });
        }
    }

    parseEPGTime(timeStr) {
        // Parse XMLTV time format: 20231205120000 +0000
        const year = parseInt(timeStr.substr(0, 4));
        const month = parseInt(timeStr.substr(4, 2)) - 1;
        const day = parseInt(timeStr.substr(6, 2));
        const hour = parseInt(timeStr.substr(8, 2));
        const minute = parseInt(timeStr.substr(10, 2));
        const second = parseInt(timeStr.substr(12, 2));
        
        return new Date(year, month, day, hour, minute, second);
    }

    processXtreamEPG(epgData) {
        this.epgData = {};
        
        if (epgData && epgData.epg_listings) {
            for (const [channelId, listings] of Object.entries(epgData.epg_listings)) {
                this.epgData[channelId] = listings.map(listing => ({
                    title: listing.title,
                    desc: listing.description,
                    start: new Date(listing.start_timestamp * 1000),
                    stop: new Date(listing.stop_timestamp * 1000)
                }));
            }
        }
    }

    async fetchWithCORS(url) {
        // For development, we'll use a CORS proxy or handle CORS issues
        try {
            return await fetch(url);
        } catch (error) {
            // Fallback: try with CORS proxy
            const proxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
            return await fetch(proxyUrl);
        }
    }

    saveConnection() {
        const connectionInfo = {
            type: this.connectionType,
            data: this.connectionData
        };
        localStorage.setItem('iptv-connection', JSON.stringify(connectionInfo));
    }

    loadContent() {
        if (this.connectionType === 'm3u') {
            this.parseM3U(this.connectionData.content);
            if (this.connectionData.epgUrl) {
                this.loadEPGFromURL(this.connectionData.epgUrl);
            }
            this.displayContent();
        } else if (this.connectionType === 'xtream') {
            this.loadXtreamCategories().then(() => {
                this.displayInitialContent();
            });
        }
    }

    displayContent() {
        this.displayChannels();
        this.displayMovies();
        this.displaySeries();
        this.loadEPG();
    }

    displayInitialContent() {
        if (this.connectionType === 'xtream') {
            // Show categories for Xtream connections
            this.showChannelCategories();
            this.showMovieCategories();
            this.showSeriesCategories();
        } else {
            // For M3U, show content directly
            this.displayChannels();
            this.displayMovies();
            this.displaySeries();
        }
        
        this.loadEPG();
    }

    showInfoMessage(containerId, title, message) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="col-12">
                <div class="card bg-dark bg-opacity-50 text-white border-secondary">
                    <div class="card-body text-center p-5">
                        <i class="fas fa-info-circle fa-3x text-info mb-3"></i>
                        <h4 class="text-info">${title}</h4>
                        <p class="text-white-50">${message}</p>
                    </div>
                </div>
            </div>
        `;
    }

    showChannelCategories() {
        const categoriesContainer = document.getElementById('channels-categories');
        const listContainer = document.getElementById('channels-list');
        const backButton = document.getElementById('back-to-channel-categories');
        
        // Show categories, hide list
        categoriesContainer.style.display = 'flex';
        listContainer.style.display = 'none';
        backButton.classList.add('d-none');
        
        categoriesContainer.innerHTML = '';
        
        if (this.channelCategories.length === 0) {
            this.showLoadingMessage('channels-categories', 'Carregando categorias...');
            return;
        }
        
        this.channelCategories.forEach(category => {
            const categoryCard = this.createCategoryCard(category, 'channel');
            categoriesContainer.appendChild(categoryCard);
        });
    }

    showMovieCategories() {
        const categoriesContainer = document.getElementById('movies-categories');
        const listContainer = document.getElementById('movies-list');
        const backButton = document.getElementById('back-to-movie-categories');
        
        // Show categories, hide list
        categoriesContainer.style.display = 'flex';
        listContainer.style.display = 'none';
        backButton.classList.add('d-none');
        
        categoriesContainer.innerHTML = '';
        
        if (this.movieCategories.length === 0) {
            this.showLoadingMessage('movies-categories', 'Carregando categorias...');
            return;
        }
        
        this.movieCategories.forEach(category => {
            const categoryCard = this.createCategoryCard(category, 'movie');
            categoriesContainer.appendChild(categoryCard);
        });
    }

    showSeriesCategories() {
        const categoriesContainer = document.getElementById('series-categories');
        const listContainer = document.getElementById('series-list');
        const backButton = document.getElementById('back-to-series-categories');
        
        // Show categories, hide list
        categoriesContainer.style.display = 'flex';
        listContainer.style.display = 'none';
        backButton.classList.add('d-none');
        
        categoriesContainer.innerHTML = '';
        
        if (this.seriesCategories.length === 0) {
            this.showLoadingMessage('series-categories', 'Carregando categorias...');
            return;
        }
        
        this.seriesCategories.forEach(category => {
            const categoryCard = this.createCategoryCard(category, 'series');
            categoriesContainer.appendChild(categoryCard);
        });
    }

    createCategoryCard(category, type) {
        const div = document.createElement('div');
        div.className = 'col-lg-3 col-md-4 col-sm-6';
        
        const icon = type === 'channel' ? 'fas fa-tv' : 
                    type === 'movie' ? 'fas fa-film' : 'fas fa-video';
        
        div.innerHTML = `
            <div class="card bg-gradient text-white h-100 border-secondary category-card" style="cursor: pointer; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);">
                <div class="card-body text-center p-4">
                    <i class="${icon} fa-3x text-warning mb-3"></i>
                    <h5 class="card-title">${category.category_name}</h5>
                    <p class="card-text text-white-50">Clique para ver ${type === 'channel' ? 'canais' : type === 'movie' ? 'filmes' : 'séries'}</p>
                </div>
            </div>
        `;

        div.querySelector('.category-card').addEventListener('click', () => {
            this.selectCategory(category, type);
        });

        return div;
    }

    async selectCategory(category, type) {
        if (type === 'channel') {
            this.currentChannelCategory = category;
            await this.loadChannelsByCategory(category.category_id);
            this.showChannelsList();
        } else if (type === 'movie') {
            this.currentMovieCategory = category;
            await this.loadMoviesByCategory(category.category_id);
            this.showMoviesList();
        } else if (type === 'series') {
            this.currentSeriesCategory = category;
            await this.loadSeriesByCategory(category.category_id);
            this.showSeriesList();
        }
    }

    showChannelsList() {
        const categoriesContainer = document.getElementById('channels-categories');
        const listContainer = document.getElementById('channels-list');
        const backButton = document.getElementById('back-to-channel-categories');
        
        // Hide categories, show list
        categoriesContainer.style.display = 'none';
        listContainer.style.display = 'flex';
        backButton.classList.remove('d-none');
        
        // Display channels
        listContainer.innerHTML = '';
        this.channels.forEach(channel => {
            const channelElement = this.createContentItem(channel, 'channel');
            listContainer.appendChild(channelElement);
        });
    }

    showMoviesList() {
        const categoriesContainer = document.getElementById('movies-categories');
        const listContainer = document.getElementById('movies-list');
        const backButton = document.getElementById('back-to-movie-categories');
        
        // Hide categories, show list
        categoriesContainer.style.display = 'none';
        listContainer.style.display = 'flex';
        backButton.classList.remove('d-none');
        
        // Display movies
        listContainer.innerHTML = '';
        this.movies.forEach(movie => {
            const movieElement = this.createContentItem(movie, 'movie');
            listContainer.appendChild(movieElement);
        });
    }

    showSeriesList() {
        const categoriesContainer = document.getElementById('series-categories');
        const listContainer = document.getElementById('series-list');
        const backButton = document.getElementById('back-to-series-categories');
        
        // Hide categories, show list
        categoriesContainer.style.display = 'none';
        listContainer.style.display = 'flex';
        backButton.classList.remove('d-none');
        
        // Display series
        listContainer.innerHTML = '';
        this.series.forEach(serie => {
            const serieElement = this.createContentItem(serie, 'serie');
            listContainer.appendChild(serieElement);
        });
    }

    async displayChannels() {
        if (this.connectionType === 'xtream') {
            this.showChannelCategories();
        } else {
            // M3U - show channels directly
            const container = document.getElementById('channels-list');
            container.innerHTML = '';
            this.channels.forEach(channel => {
                const channelElement = this.createContentItem(channel, 'channel');
                container.appendChild(channelElement);
            });
        }
    }

    async displayMovies() {
        if (this.connectionType === 'xtream') {
            this.showMovieCategories();
        } else {
            // M3U - show movies directly (if any)
            const container = document.getElementById('movies-list');
            container.innerHTML = '';
            this.movies.forEach(movie => {
                const movieElement = this.createContentItem(movie, 'movie');
                container.appendChild(movieElement);
            });
        }
    }

    async displaySeries() {
        if (this.connectionType === 'xtream') {
            this.showSeriesCategories();
        } else {
            // M3U - show series directly (if any)
            const container = document.getElementById('series-list');
            container.innerHTML = '';
            this.series.forEach(serie => {
                const serieElement = this.createContentItem(serie, 'serie');
                container.appendChild(serieElement);
            });
        }
    }

    showLoadingMessage(containerId, message) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="col-12">
                <div class="card bg-dark text-white border-secondary">
                    <div class="card-body text-center p-4">
                        <div class="spinner-border text-warning mb-3" role="status">
                            <span class="visually-hidden">Carregando...</span>
                        </div>
                        <h5>${message}</h5>
                    </div>
                </div>
            </div>
        `;
    }

    createContentItem(item, type) {
        const div = document.createElement('div');
        div.className = 'col-lg-3 col-md-4 col-sm-6';
        
        const isLive = type === 'channel';
        const liveIndicator = isLive ? '<span class="badge bg-danger position-absolute top-0 start-0 m-2"><i class="fas fa-circle me-1" style="font-size: 8px;"></i>AO VIVO</span>' : '';
        
        div.innerHTML = `
            <div class="card bg-dark text-white h-100 border-secondary content-item" style="cursor: pointer;">
                <div class="position-relative">
                    ${item.logo ? `<img src="${item.logo}" class="card-img-top" alt="${item.name}" style="height: 200px; object-fit: cover;" onerror="this.style.display='none'">` : '<div class="card-img-top bg-secondary d-flex align-items-center justify-content-center" style="height: 200px;"><i class="fas fa-tv fa-3x text-muted"></i></div>'}
                    ${liveIndicator}
                </div>
                <div class="card-body">
                    <h6 class="card-title text-truncate">${item.name}</h6>
                    ${item.category ? `<p class="card-text"><small class="text-muted"><i class="fas fa-tag me-1"></i>${item.category}</small></p>` : ''}
                    ${item.plot ? `<p class="card-text small">${item.plot.substring(0, 80)}...</p>` : ''}
                    <div class="d-flex justify-content-between align-items-center">
                        ${item.year ? `<small class="text-muted">${item.year}</small>` : '<span></span>'}
                        ${item.rating ? `<small class="text-warning">⭐ ${item.rating}</small>` : ''}
                    </div>

                </div>
            </div>
        `;

        div.querySelector('.content-item').addEventListener('click', (e) => {
            // Don't trigger if clicked on buttons
            if (e.target.closest('button')) return;
            
            if (type === 'serie') {
                this.showSerieEpisodes(item);
            } else {
                // For all other types (channels, movies), use player
                this.playContent(item);
            }
        });

        return div;
    }

    async showSerieEpisodes(serie) {
        if (this.connectionType === 'xtream') {
            const { url, username, password } = this.connectionData;
            try {
                const response = await this.fetchWithCORS(`${url}/player_api.php?username=${username}&password=${password}&action=get_series_info&series_id=${serie.series_id}`);
                const serieInfo = await response.json();
                
                // Create episodes modal or update content area
                this.showEpisodesModal(serieInfo, serie);
            } catch (error) {
                console.error('Error loading episodes:', error);
            }
        }
    }

    showEpisodesModal(serieInfo, serie) {
        // Create a simple episodes list for now
        const episodes = [];
        
        if (serieInfo.seasons) {
            Object.values(serieInfo.seasons).forEach(season => {
                Object.values(season).forEach(episode => {
                    episodes.push({
                        name: `S${episode.season_number}E${episode.episode_num} - ${episode.title}`,
                        url: `${this.connectionData.url}/series/${this.connectionData.username}/${this.connectionData.password}/${episode.id}.${episode.container_extension}`,
                        plot: episode.plot
                    });
                });
            });
        }

        if (episodes.length > 0) {
            this.playContent(episodes[0]); // Play first episode for now
        }
    }

    playContent(item) {
        const modal = new bootstrap.Modal(document.getElementById('player-modal'));
        const video = document.getElementById('video-player');
        const title = document.getElementById('player-title');

        // Store current item for reload functionality
        this.currentItem = item;
        
        title.innerHTML = `<i class="fas fa-tv me-2"></i>${item.name}`;
        modal.show();

        // Destroy existing players
        if (this.currentPlayer) {
            this.currentPlayer.destroy();
        }
        if (this.plyrPlayer) {
            this.plyrPlayer.destroy();
        }

        // Initialize HLS with Plyr
        if (Hls.isSupported()) {
            this.currentPlayer = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });
            
            this.currentPlayer.loadSource(item.url);
            this.currentPlayer.attachMedia(video);
            
            // Initialize Plyr
            this.plyrPlayer = new Plyr(video, {
                controls: [
                    'play-large',
                    'restart',
                    'rewind',
                    'play',
                    'fast-forward',
                    'progress',
                    'current-time',
                    'duration',
                    'mute',
                    'volume',
                    'captions',
                    'settings',
                    'pip',
                    'airplay',
                    'fullscreen'
                ],
                settings: ['captions', 'quality', 'speed'],
                quality: {
                    default: 'auto',
                    options: ['auto']
                }
            });
            
            this.currentPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(e => console.log('Autoplay prevented:', e));
            });

            this.currentPlayer.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS Error:', data);
                if (data.fatal) {
                    this.handlePlayerError(item);
                }
            });
            
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = item.url;
            this.plyrPlayer = new Plyr(video);
            video.play().catch(e => console.log('Autoplay prevented:', e));
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Navegador Incompatível',
                text: 'Seu navegador não suporta reprodução de streams HLS.',
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700'
            });
        }

        // Update EPG info if available
        this.updatePlayerEPG(item);
    }

    handlePlayerError(item) {
        const video = document.getElementById('video-player');
        
        // Try fallback methods
        if (item.url.includes('.m3u8')) {
            // Try direct video tag
            video.src = item.url;
            video.play().catch(e => {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro de Reprodução',
                    text: 'Erro ao reproduzir o conteúdo. Verifique se o stream está disponível.',
                    background: '#1e3c72',
                    color: '#ffffff',
                    confirmButtonColor: '#ffd700'
                });
            });
        }
    }

    updatePlayerEPG(item) {
        const currentProgram = document.getElementById('current-program');
        const nextProgram = document.getElementById('next-program');
        
        if (item.epg_channel_id && this.epgData[item.epg_channel_id]) {
            const now = new Date();
            const programs = this.epgData[item.epg_channel_id];
            
            const current = programs.find(p => p.start <= now && p.stop > now);
            const next = programs.find(p => p.start > now);
            
            if (current) {
                currentProgram.innerHTML = `<strong>Agora:</strong> ${current.title}`;
            }
            
            if (next) {
                nextProgram.innerHTML = `<strong>Próximo:</strong> ${next.title} (${next.start.toLocaleTimeString()})`;
            }
        } else {
            currentProgram.innerHTML = '';
            nextProgram.innerHTML = '';
        }
    }

    closePlayer() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('player-modal'));
        const video = document.getElementById('video-player');
        
        if (modal) {
            modal.hide();
        }
        
        if (video) {
            video.pause();
            video.src = '';
        }
        
        if (this.currentPlayer) {
            this.currentPlayer.destroy();
            this.currentPlayer = null;
        }
        
        if (this.plyrPlayer) {
            this.plyrPlayer.destroy();
            this.plyrPlayer = null;
        }
        
        this.currentItem = null;
    }

    reloadVideo() {
        if (this.currentItem) {
            // Pause current video
            const video = document.getElementById('video-player');
            if (video) {
                video.pause();
            }
            
            // Show loading indicator
            Swal.fire({
                title: 'Recarregando...',
                text: 'Reiniciando o vídeo',
                icon: 'info',
                timer: 1500,
                showConfirmButton: false,
                background: '#1e3c72',
                color: '#ffffff'
            });
            
            // Reload the video after a short delay
            setTimeout(() => {
                this.playContent(this.currentItem);
            }, 500);
        }
    }

    toggleFullscreen() {
        const video = document.getElementById('video-player');
        const modal = document.getElementById('player-modal');
        const icon = document.getElementById('fullscreen-icon');
        
        if (!document.fullscreenElement) {
            // Enter fullscreen
            if (modal.requestFullscreen) {
                modal.requestFullscreen();
            } else if (modal.webkitRequestFullscreen) {
                modal.webkitRequestFullscreen();
            } else if (modal.msRequestFullscreen) {
                modal.msRequestFullscreen();
            }
            
            if (icon) {
                icon.className = 'fas fa-compress';
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            
            if (icon) {
                icon.className = 'fas fa-expand';
            }
        }
    }

    async showSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(item => {
            item.classList.remove('active');
        });
        event.target.classList.add('active');

        // Update content sections
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
            sec.style.display = 'none';
        });
        const targetSection = document.getElementById(`${section}-section`);
        targetSection.classList.add('active');
        targetSection.style.display = 'block';

        this.currentSection = section;

        // Load content on demand
        switch (section) {
            case 'channels':
                await this.displayChannels();
                break;
            case 'movies':
                await this.displayMovies();
                break;
            case 'series':
                await this.displaySeries();
                break;
            case 'epg':
                this.loadEPG();
                break;
        }
    }

    loadEPG() {
        const container = document.getElementById('epg-content');
        const selectedDate = new Date(document.getElementById('epg-date').value);
        
        container.innerHTML = '';

        if (Object.keys(this.epgData).length === 0) {
            container.innerHTML = '<p>Dados de EPG não disponíveis.</p>';
            return;
        }

        Object.entries(this.epgData).forEach(([channelId, programs]) => {
            const channel = this.channels.find(c => c.epg_channel_id === channelId);
            if (!channel) return;

            const channelDiv = document.createElement('div');
            channelDiv.className = 'epg-channel';

            const channelName = document.createElement('h3');
            channelName.textContent = channel.name;
            channelDiv.appendChild(channelName);

            const dayPrograms = programs.filter(p => {
                const programDate = new Date(p.start);
                return programDate.toDateString() === selectedDate.toDateString();
            });

            if (dayPrograms.length === 0) {
                const noPrograms = document.createElement('p');
                noPrograms.textContent = 'Nenhum programa encontrado para esta data.';
                channelDiv.appendChild(noPrograms);
            } else {
                dayPrograms.forEach(program => {
                    const programDiv = document.createElement('div');
                    programDiv.className = 'epg-program';
                    
                    const now = new Date();
                    if (program.start <= now && program.stop > now) {
                        programDiv.classList.add('current');
                    }

                    programDiv.innerHTML = `
                        <div class="time">${program.start.toLocaleTimeString()} - ${program.stop.toLocaleTimeString()}</div>
                        <div class="title">${program.title}</div>
                    `;

                    if (program.desc) {
                        const desc = document.createElement('div');
                        desc.className = 'description';
                        desc.textContent = program.desc;
                        programDiv.appendChild(desc);
                    }

                    channelDiv.appendChild(programDiv);
                });
            }

            container.appendChild(channelDiv);
        });
    }

    filterContent(type, query) {
        // Check if we're in categories view or content view
        const categoriesContainer = document.getElementById(`${type}-categories`);
        const listContainer = document.getElementById(`${type}-list`);
        
        const isShowingCategories = categoriesContainer.style.display !== 'none';
        const targetContainer = isShowingCategories ? categoriesContainer : listContainer;
        
        const items = targetContainer.querySelectorAll('.col-lg-3');
        
        items.forEach(item => {
            const title = item.querySelector('.card-title').textContent.toLowerCase();
            const textElements = item.querySelectorAll('.text-muted, .card-text');
            let searchText = title;
            
            textElements.forEach(el => {
                searchText += ' ' + el.textContent.toLowerCase();
            });
            
            if (searchText.includes(query.toLowerCase())) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    refreshContent() {
        this.showLoading(true);
        setTimeout(() => {
            this.loadContent();
            this.showLoading(false);
        }, 1000);
    }

    async disconnect() {
        const result = await Swal.fire({
            title: 'Desconectar?',
            text: 'Tem certeza que deseja desconectar do servidor?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sim, desconectar',
            cancelButtonText: 'Cancelar',
            background: '#1e3c72',
            color: '#ffffff'
        });

        if (result.isConfirmed) {
            localStorage.removeItem('iptv-connection');
            this.connectionType = null;
            this.connectionData = null;
            this.channels = [];
            this.movies = [];
            this.series = [];
            this.epgData = {};
            this.channelCategories = [];
            this.movieCategories = [];
            this.seriesCategories = [];
            
            if (this.currentPlayer) {
                this.currentPlayer.destroy();
                this.currentPlayer = null;
            }
            
            this.showScreen('connection-selector');
            
            Swal.fire({
                title: 'Desconectado!',
                text: 'Você foi desconectado com sucesso.',
                icon: 'success',
                timer: 2000,
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700'
            });
        }
    }

    goBack() {
        this.showScreen('connection-selector');
    }

    showScreen(screenId) {
        console.log('Showing screen:', screenId);
        
        // Remove active class from all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Add active class to target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            console.log('Screen activated:', screenId);
        } else {
            console.error('Screen not found:', screenId);
        }
        
        // Force reflow to ensure the display change takes effect
        if (targetScreen) {
            targetScreen.offsetHeight;
        }
        
        // Reset any inline styles that might interfere
        document.querySelectorAll('.screen').forEach(screen => {
            screen.style.opacity = '';
            screen.style.transition = '';
        });
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('d-none');
            overlay.classList.add('d-flex');
        } else {
            overlay.classList.remove('d-flex');
            overlay.classList.add('d-none');
        }
    }

    // Sistema de Favoritos
    loadFavorites() {
        const stored = localStorage.getItem('iptv-favorites');
        if (stored) {
            try {
                this.favorites = JSON.parse(stored);
            } catch (error) {
                console.error('Error loading favorites:', error);
                this.favorites = [];
            }
        }
    }

    loadRecentConnections() {
        const stored = localStorage.getItem('iptv-recent-connections');
        if (stored) {
            try {
                this.recentConnections = JSON.parse(stored);
            } catch (error) {
                console.error('Error loading recent connections:', error);
                this.recentConnections = [];
            }
        }
        this.displayRecentConnections();
    }

    saveRecentConnection(connectionData, connectionType) {
        const recentConnection = {
            id: Date.now(),
            type: connectionType,
            data: connectionData,
            name: this.generateConnectionName(connectionData, connectionType),
            lastUsed: new Date().toISOString()
        };

        // Remove existing connection if it exists
        this.recentConnections = this.recentConnections.filter(conn => 
            !(conn.type === connectionType && this.isSameConnection(conn.data, connectionData))
        );

        // Add to beginning of array
        this.recentConnections.unshift(recentConnection);

        // Keep only last 5 connections
        this.recentConnections = this.recentConnections.slice(0, 5);

        localStorage.setItem('iptv-recent-connections', JSON.stringify(this.recentConnections));
        this.displayRecentConnections();
    }

    generateConnectionName(data, type) {
        if (type === 'xtream') {
            return `${data.url.split('://')[1]?.split('/')[0] || 'Servidor'} - ${data.username}`;
        } else {
            const url = new URL(data.url || data.content);
            return `M3U - ${url.hostname}`;
        }
    }

    isSameConnection(data1, data2) {
        if (data1.type !== data2.type) return false;
        
        if (data1.type === 'xtream') {
            return data1.url === data2.url && data1.username === data2.username;
        } else {
            return data1.url === data2.url;
        }
    }

    displayRecentConnections() {
        const container = document.getElementById('recent-connections-list');
        const section = document.getElementById('recent-connections-section');
        
        if (!container) return;

        container.innerHTML = '';

        if (this.recentConnections.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        this.recentConnections.forEach(connection => {
            const div = document.createElement('div');
            div.className = 'col-md-6 col-lg-4';
            
            const typeIcon = connection.type === 'm3u' ? 'fas fa-list' : 'fas fa-server';
            const typeColor = connection.type === 'm3u' ? 'primary' : 'success';
            
            div.innerHTML = `
                <div class="card bg-dark bg-opacity-75 text-white h-100 border-secondary recent-connection-card" style="cursor: pointer;">
                    <div class="card-body p-3">
                        <div class="d-flex align-items-center mb-2">
                            <i class="${typeIcon} text-${typeColor} me-2"></i>
                            <h6 class="card-title mb-0 text-truncate">${connection.name}</h6>
                        </div>
                        <p class="card-text small text-white-50 mb-0">
                            <i class="fas fa-clock me-1"></i>
                            ${new Date(connection.lastUsed).toLocaleDateString()} às ${new Date(connection.lastUsed).toLocaleTimeString()}
                        </p>
                    </div>
                </div>
            `;
            
            div.querySelector('.recent-connection-card').addEventListener('click', () => {
                this.connectFromRecent(connection);
            });
            
            container.appendChild(div);
        });
    }

    async connectFromRecent(connection) {
        this.showLoading(true);
        
        try {
            this.connectionType = connection.type;
            this.connectionData = connection.data;

            if (connection.type === 'xtream') {
                await this.loadXtreamCategories();
                this.displayInitialContent();
            } else {
                if (connection.data.content) {
                    this.parseM3U(connection.data.content);
                } else {
                    // If we don't have content cached, fetch it again
                    const response = await this.fetchWithCORS(connection.data.url);
                    const content = await response.text();
                    this.parseM3U(content);
                    connection.data.content = content; // Cache it
                }
                
                if (connection.data.epgUrl) {
                    await this.loadEPGFromURL(connection.data.epgUrl);
                }
                this.displayContent();
            }

            this.showScreen('main-screen');
            this.saveRecentConnection(connection.data, connection.type);

            Swal.fire({
                icon: 'success',
                title: 'Conectado!',
                text: `Reconectado a ${connection.name}`,
                timer: 2000,
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700'
            });

        } catch (error) {
            console.error('Error connecting from recent:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro na Conexão',
                text: 'Não foi possível reconectar. Tente novamente.',
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700'
            });
        } finally {
            this.showLoading(false);
        }
    }

    saveFavorites() {
        localStorage.setItem('iptv-favorites', JSON.stringify(this.favorites));
    }

    saveFavorite() {
        if (!this.connectionType || !this.connectionData) {
            Swal.fire({
                icon: 'warning',
                title: 'Nenhuma Conexão',
                text: 'Conecte-se primeiro a uma lista ou servidor.',
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700'
            });
            return;
        }

        Swal.fire({
            title: 'Salvar Lista',
            text: 'Digite um nome para esta lista:',
            input: 'text',
            inputValue: `${this.connectionType.toUpperCase()} - ${new Date().toLocaleDateString()}`,
            showCancelButton: true,
            confirmButtonText: 'Salvar',
            cancelButtonText: 'Cancelar',
            background: '#1e3c72',
            color: '#ffffff',
            confirmButtonColor: '#ffd700',
            cancelButtonColor: '#6c757d',
            inputValidator: (value) => {
                if (!value) {
                    return 'Digite um nome para a lista!'
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const favorite = {
                    id: Date.now(),
                    name: result.value,
                    type: this.connectionType,
                    data: this.connectionData,
                    createdAt: new Date().toISOString()
                };

                this.favorites.push(favorite);
                this.saveFavorites();
                this.displayFavorites();

                Swal.fire({
                    icon: 'success',
                    title: 'Lista Salva!',
                    text: `"${result.value}" foi salva nos favoritos.`,
                    timer: 2000,
                    background: '#1e3c72',
                    color: '#ffffff',
                    confirmButtonColor: '#ffd700'
                });
            }
        });
    }

    showFavorites() {
        this.displayFavorites();
        const modal = new bootstrap.Modal(document.getElementById('favorites-modal'));
        modal.show();
    }

    displayFavorites() {
        const container = document.getElementById('favorites-list');
        container.innerHTML = '';

        if (this.favorites.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="card bg-secondary text-white">
                        <div class="card-body text-center p-4">
                            <i class="fas fa-heart fa-3x text-muted mb-3"></i>
                            <h5>Nenhuma lista salva</h5>
                            <p class="text-white-50">Conecte-se a uma lista e clique em "Salvar Lista Atual"</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        this.favorites.forEach(favorite => {
            const div = document.createElement('div');
            div.className = 'col-md-6';
            
            const typeIcon = favorite.type === 'm3u' ? 'fas fa-list' : 'fas fa-server';
            const typeColor = favorite.type === 'm3u' ? 'primary' : 'success';
            
            div.innerHTML = `
                <div class="card bg-secondary text-white h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="card-title mb-0">
                                <i class="${typeIcon} me-2 text-${typeColor}"></i>
                                ${favorite.name}
                            </h6>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteFavorite(${favorite.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <p class="card-text small text-white-50 mb-3">
                            <i class="fas fa-calendar me-1"></i>
                            ${new Date(favorite.createdAt).toLocaleDateString()}
                        </p>
                        <button class="btn btn-warning btn-sm w-100" onclick="loadFavorite(${favorite.id})">
                            <i class="fas fa-play me-1"></i>Conectar
                        </button>
                    </div>
                </div>
            `;
            
            container.appendChild(div);
        });
    }

    async loadFavorite(favoriteId) {
        const favorite = this.favorites.find(f => f.id === favoriteId);
        if (!favorite) return;

        // Close favorites modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('favorites-modal'));
        if (modal) modal.hide();

        this.showLoading(true);

        try {
            this.connectionType = favorite.type;
            this.connectionData = favorite.data;

            if (favorite.type === 'xtream') {
                await this.loadXtreamCategories();
                this.displayInitialContent();
            } else {
                this.parseM3U(this.connectionData.content);
                if (this.connectionData.epgUrl) {
                    await this.loadEPGFromURL(this.connectionData.epgUrl);
                }
                this.displayContent();
            }

            this.showScreen('main-screen');

            Swal.fire({
                icon: 'success',
                title: 'Lista Carregada!',
                text: `"${favorite.name}" foi carregada com sucesso.`,
                timer: 2000,
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700'
            });

        } catch (error) {
            console.error('Error loading favorite:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro ao Carregar',
                text: 'Erro ao conectar com a lista salva.',
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700'
            });
        } finally {
            this.showLoading(false);
        }
    }

    deleteFavorite(favoriteId) {
        const favorite = this.favorites.find(f => f.id === favoriteId);
        if (!favorite) return;

        Swal.fire({
            title: 'Excluir Favorito?',
            text: `Tem certeza que deseja excluir "${favorite.name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar',
            background: '#1e3c72',
            color: '#ffffff'
        }).then((result) => {
            if (result.isConfirmed) {
                this.favorites = this.favorites.filter(f => f.id !== favoriteId);
                this.saveFavorites();
                this.displayFavorites();

                Swal.fire({
                    icon: 'success',
                    title: 'Excluído!',
                    text: 'Favorito foi removido.',
                    timer: 1500,
                    background: '#1e3c72',
                    color: '#ffffff',
                    confirmButtonColor: '#ffd700'
                });
            }
        });
    }


}

// Global functions for HTML event handlers
function selectConnectionType(type) {
    player.selectConnectionType(type);
}

function goBack() {
    player.goBack();
}

function showSection(section) {
    player.showSection(section);
}

function closePlayer() {
    player.closePlayer();
}

function refreshContent() {
    player.refreshContent();
}

function disconnect() {
    player.disconnect();
}

function loadEPG() {
    player.loadEPG();
}

function showChannelCategories() {
    player.showChannelCategories();
}

function showMovieCategories() {
    player.showMovieCategories();
}

function showSeriesCategories() {
    player.showSeriesCategories();
}

// Global functions for favorites
function loadFavorite(id) {
    player.loadFavorite(id);
}

function deleteFavorite(id) {
    player.deleteFavorite(id);
}

// Player control functions
function closePlayer() {
    player.closePlayer();
}

function reloadVideo() {
    player.reloadVideo();
}

function toggleFullscreen() {
    player.toggleFullscreen();
}

// Initialize the application
const player = new IPTVPlayer();