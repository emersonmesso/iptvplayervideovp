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
        
        // Check for list_id in URL and auto-connect if found
        this.checkUrlForListId();
        
        // Ensure only connection-selector is shown initially
        this.showScreen('connection-selector');
        
        // Debug: log initial screen states
        console.log('Initial screen states:');
        document.querySelectorAll('.screen').forEach(screen => {
            console.log(`${screen.id}: active=${screen.classList.contains('active')}, display=${getComputedStyle(screen).display}`);
        });
    }

    async checkUrlForListId() {
        const urlParams = new URLSearchParams(window.location.search);
        const listId = urlParams.get('list_id');
        
        if (listId) {
            console.log('Found list_id in URL:', listId);
            
            try {
                // Show loading while fetching data
                this.showLoading(true, 'Buscando dados do servidor...', 'Conectando automaticamente...');
                
                // Fetch server data using list_id
                const serverData = await this.fetchServerDataByListId(listId);
                
                if (serverData) {
                    // Auto-connect based on server type
                    if (serverData.type === 'xtream') {
                        await this.autoConnectXtream(serverData);
                    } else if (serverData.type === 'm3u') {
                        await this.autoConnectM3U(serverData);
                    }
                } else {
                    throw new Error('Dados do servidor não encontrados');
                }
                
            } catch (error) {
                console.error('Error auto-connecting with list_id:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro de Conexão Automática',
                    text: `Não foi possível conectar automaticamente com o list_id: ${listId}. ${error.message}`,
                    background: '#1e3c72',
                    color: '#ffffff',
                    confirmButtonColor: '#ffd700'
                });
            } finally {
                this.showLoading(false);
            }
        }
    }

    async fetchServerDataByListId(listId) {
        try {
            // Use the correct Vector Player API endpoint
            const apiUrl = `https://vectorplayer.com/api/v1/lista/get_premium_list?list_id=${listId}`;
            
            console.log('Fetching server data from:', apiUrl);
            
            let response;
            let result;
            
            // Try multiple methods to bypass CORS
            try {
                // Method 1: Try direct fetch first
                response = await fetch(apiUrl, {
                    method: 'GET',
                    mode: 'cors',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    result = await response.json();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
                
            } catch (corsError) {
                console.log('CORS error, trying alternative methods:', corsError.message);
                
                // Method 2: Try using a CORS proxy
                const proxyUrls = [
                    `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`,
                    `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`,
                    `https://cors-anywhere.herokuapp.com/${apiUrl}`
                ];
                
                let proxySuccess = false;
                
                for (const proxyUrl of proxyUrls) {
                    try {
                        console.log('Trying proxy:', proxyUrl);
                        response = await fetch(proxyUrl);
                        
                        if (response.ok) {
                            const proxyData = await response.json();
                            
                            // Handle different proxy response formats
                            if (proxyData.contents) {
                                // allorigins format
                                result = JSON.parse(proxyData.contents);
                            } else if (proxyData.status) {
                                // Direct proxy response
                                result = proxyData;
                            } else {
                                // Raw response
                                result = proxyData;
                            }
                            
                            proxySuccess = true;
                            break;
                        }
                    } catch (proxyError) {
                        console.log('Proxy failed:', proxyError.message);
                        continue;
                    }
                }
                
                if (!proxySuccess) {
                    // Method 3: Use mock data for testing (remove this in production)
                    if (listId === '104092') {
                        console.log('Using mock data for testing');
                        result = {
                            "status": "sucess",
                            "version": "1.0.5",
                            "update": "https://vectorplayer.com/releases/download/tv",
                            "error": false,
                            "runs": [],
                            "data": {
                                "id": "104092",
                                "url_servidor": "http://dns.ortotrauma.online:8080/",
                                "porta": "8080",
                                "usuario": "Ralphdelgado",
                                "senha": "Ral663",
                                "data_expira": "1762431935",
                                "max_con": "2",
                                "con_active": "0",
                                "status": "Active",
                                "json": "{\"user_info\":{\"username\":\"Ralphdelgado\",\"password\":\"Ral663\",\"message\":\"\",\"auth\":1,\"status\":\"Active\",\"exp_date\":\"1757161535\",\"is_trial\":\"0\",\"active_cons\":\"0\",\"created_at\":\"1754144767\",\"max_connections\":\"2\",\"allowed_output_formats\":[\"m3u8\",\"ts\",\"rtmp\"]},\"server_info\":{\"url\":\"dns.ortotrauma.online\",\"port\":\"8080\",\"https_port\":\"8443\",\"server_protocol\":\"http\",\"rtmp_port\":\"25462\",\"timezone\":\"America/Sao_Paulo\",\"timestamp_now\":1755274133,\"time_now\":\"2025-08-15 13:08:53\",\"process\":true}}",
                                "is_br": "1",
                                "protected": null
                            }
                        };
                    } else {
                        throw new Error('CORS bypass failed and no mock data available for this list_id');
                    }
                }
            }
            console.log('API Response:', result);
            
            // Check if the response is successful
            if (result.status !== 'sucess' || result.error || !result.data) {
                throw new Error('Invalid response from server');
            }
            
            const serverData = result.data;
            
            // Parse the JSON string in the data.json field to get additional server info
            let serverInfo = {};
            try {
                if (serverData.json) {
                    serverInfo = JSON.parse(serverData.json);
                }
            } catch (jsonError) {
                console.warn('Could not parse server info JSON:', jsonError);
            }
            
            // Convert the API response to the format expected by the player
            const connectionData = {
                type: 'xtream', // Vector Player uses Xtream Codes API
                url: serverData.url_servidor,
                username: serverData.usuario,
                password: serverData.senha,
                listId: serverData.id,
                // Additional server information
                serverInfo: {
                    expiration: serverData.data_expira,
                    maxConnections: serverData.max_con,
                    activeConnections: serverData.con_active,
                    status: serverData.status,
                    port: serverData.porta,
                    isBrazilian: serverData.is_br === "1",
                    userInfo: serverInfo.user_info || {},
                    serverInfo: serverInfo.server_info || {}
                }
            };
            
            console.log('Processed connection data:', connectionData);
            return connectionData;
            
        } catch (error) {
            console.error('Error fetching server data by list_id:', error);
            
            // Fallback: check if list_id exists in recent connections
            const recentConnection = this.recentConnections.find(conn => 
                conn.id && (conn.id.toString() === listId || 
                (conn.data && conn.data.listId === listId))
            );
            
            if (recentConnection) {
                console.log('Found server data in recent connections');
                return {
                    type: recentConnection.type,
                    ...recentConnection.data
                };
            }
            
            // Fallback: check if list_id exists in favorites
            const favoriteConnection = this.favorites.find(fav => 
                fav.id && (fav.id.toString() === listId || 
                (fav.data && fav.data.listId === listId))
            );
            
            if (favoriteConnection) {
                console.log('Found server data in favorites');
                return {
                    type: favoriteConnection.type,
                    ...favoriteConnection.data
                };
            }
            
            throw error; // Re-throw the error if no fallback is found
        }
    }

    // Helper function to create server data for testing without CORS issues
    createMockServerData(listId) {
        // This function can be used to create mock data for testing
        // In production, you would replace this with actual API calls from your backend
        const mockServers = {
            '104092': {
                "status": "sucess",
                "version": "1.0.5",
                "error": false,
                "data": {
                    "id": "104092",
                    "url_servidor": "http://dns.ortotrauma.online:8080/",
                    "porta": "8080",
                    "usuario": "Ralphdelgado",
                    "senha": "Ral663",
                    "data_expira": "1762431935",
                    "max_con": "2",
                    "con_active": "0",
                    "status": "Active",
                    "json": "{\"user_info\":{\"username\":\"Ralphdelgado\",\"password\":\"Ral663\",\"auth\":1,\"status\":\"Active\"},\"server_info\":{\"url\":\"dns.ortotrauma.online\",\"port\":\"8080\"}}",
                    "is_br": "1"
                }
            }
            // Add more mock servers here for testing
        };
        
        return mockServers[listId] || null;
    }

    async autoConnectXtream(serverData) {
        console.log('Auto-connecting to Xtream server:', serverData);
        
        try {
            // Test authentication
            const authUrl = `${serverData.url}/player_api.php?username=${serverData.username}&password=${serverData.password}`;
            const authResponse = await this.fetchWithCORS(authUrl);
            const authData = await authResponse.json();

            if (authData.user_info && authData.user_info.auth === 1) {
                // Store connection data with server info
                this.connectionData = {
                    url: serverData.url,
                    username: serverData.username,
                    password: serverData.password,
                    listId: serverData.listId || new URLSearchParams(window.location.search).get('list_id'),
                    serverInfo: serverData.serverInfo || {}
                };
                
                this.connectionType = 'xtream';

                // Load only categories, not all content
                await this.loadXtreamCategories();
                this.saveConnection();
                
                // Save to recent connections with enhanced data
                const connectionToSave = {
                    ...this.connectionData,
                    // Add server status information if available
                    serverStatus: serverData.serverInfo ? {
                        status: serverData.serverInfo.status || 'Active',
                        expiration: serverData.serverInfo.expiration,
                        maxConnections: serverData.serverInfo.maxConnections,
                        activeConnections: serverData.serverInfo.activeConnections
                    } : {}
                };
                
                this.saveRecentConnection(connectionToSave, 'xtream');
                this.showScreen('main-screen');
                
                // Initialize with empty content - will load on demand
                this.displayInitialContent();
                
                // Show success message with server info
                const serverName = serverData.serverInfo?.serverInfo?.url || serverData.url.replace(/https?:\/\//, '').replace(/:\d+.*/, '');
                const expirationDate = serverData.serverInfo?.expiration ? 
                    new Date(parseInt(serverData.serverInfo.expiration) * 1000).toLocaleDateString('pt-BR') : 
                    'N/A';
                
                Swal.fire({
                    icon: 'success',
                    title: 'Conectado Automaticamente!',
                    html: `
                        <div style="text-align: left;">
                            <p><strong>Servidor:</strong> ${serverName}</p>
                            <p><strong>Usuário:</strong> ${serverData.username}</p>
                            <p><strong>Status:</strong> ${serverData.serverInfo?.status || 'Ativo'}</p>
                            <p><strong>Expira em:</strong> ${expirationDate}</p>
                            <p><strong>Conexões:</strong> ${serverData.serverInfo?.activeConnections || 0}/${serverData.serverInfo?.maxConnections || 'N/A'}</p>
                        </div>
                    `,
                    background: '#1e3c72',
                    color: '#ffffff',
                    confirmButtonColor: '#ffd700',
                    timer: 5000,
                    timerProgressBar: true
                });
                
            } else {
                throw new Error('Falha na autenticação');
            }

        } catch (error) {
            console.error('Error auto-connecting to Xtream:', error);
            throw new Error(`Erro na conexão Xtream: ${error.message}`);
        }
    }

    async autoConnectM3U(serverData) {
        console.log('Auto-connecting to M3U server:', serverData);
        
        try {
            const response = await this.fetchWithCORS(serverData.url);
            const m3uContent = await response.text();
            
            this.connectionData = {
                url: serverData.url,
                epgUrl: serverData.epgUrl,
                content: m3uContent,
                listId: serverData.listId || new URLSearchParams(window.location.search).get('list_id')
            };

            this.parseM3U(m3uContent);
            
            if (serverData.epgUrl) {
                await this.loadEPGFromURL(serverData.epgUrl);
            }

            this.saveConnection();
            this.saveRecentConnection(this.connectionData, 'm3u');
            this.showScreen('main-screen');
            this.displayContent();
            
            // Show success message
            Swal.fire({
                icon: 'success',
                title: 'Conectado Automaticamente!',
                text: `Lista M3U carregada com sucesso de: ${new URL(serverData.url).hostname}`,
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700',
                timer: 3000,
                timerProgressBar: true
            });

        } catch (error) {
            console.error('Error auto-connecting to M3U:', error);
            throw new Error(`Erro na conexão M3U: ${error.message}`);
        }
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
        const urlParams = new URLSearchParams(window.location.search);
        const listId = urlParams.get('list_id');

        this.showLoading(true);

        try {
            const response = await this.fetchWithCORS(url);
            const m3uContent = await response.text();
            
            this.connectionData = {
                url: url,
                epgUrl: epgUrl,
                content: m3uContent
            };
            
            // Add listId if present in URL
            if (listId) {
                this.connectionData.listId = listId;
            }

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
        const urlParams = new URLSearchParams(window.location.search);
        const listId = urlParams.get('list_id');

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
                
                // Add listId if present in URL
                if (listId) {
                    this.connectionData.listId = listId;
                }

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

        div.querySelector('.category-card').addEventListener('click', async (e) => {
            const categoryCard = e.currentTarget;
            
            // Prevent multiple clicks during loading
            if (categoryCard.classList.contains('loading')) return;
            
            // Add loading state
            categoryCard.classList.add('loading');
            
            try {
                await this.selectCategory(category, type);
            } finally {
                categoryCard.classList.remove('loading');
            }
        });

        return div;
    }

    async selectCategory(category, type) {
        const typeNames = {
            'channel': 'Canais',
            'movie': 'Filmes',
            'series': 'Séries'
        };
        
        this.showCategoryLoading(category.category_name, type);
        
        try {
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
        } catch (error) {
            console.error(`Error loading category ${category.category_name}:`, error);
            Swal.fire({
                icon: 'error',
                title: 'Erro ao Carregar Categoria',
                text: `Erro ao carregar ${category.category_name}. Tente novamente.`,
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700'
            });
        } finally {
            this.showContentLoading(false);
        }
    }

    showChannelsList() {
        const categoriesContainer = document.getElementById('channels-categories');
        const listContainer = document.getElementById('channels-list');
        const backButton = document.getElementById('back-to-channel-categories');
        
        // Hide categories, show list immediately
        categoriesContainer.style.display = 'none';
        listContainer.style.display = 'flex';
        backButton.classList.remove('d-none');
        
        // Clear container immediately
        listContainer.innerHTML = '';
        
        // Render in batches
        requestAnimationFrame(() => {
            this.renderContentInBatches(listContainer, this.channels, 'channel');
        });
    }

    showMoviesList() {
        const categoriesContainer = document.getElementById('movies-categories');
        const listContainer = document.getElementById('movies-list');
        const backButton = document.getElementById('back-to-movie-categories');
        
        // Hide categories, show list immediately
        categoriesContainer.style.display = 'none';
        listContainer.style.display = 'flex';
        backButton.classList.remove('d-none');
        
        // Clear container immediately
        listContainer.innerHTML = '';
        
        // Render in batches
        requestAnimationFrame(() => {
            this.renderContentInBatches(listContainer, this.movies, 'movie');
        });
    }

    showSeriesList() {
        const categoriesContainer = document.getElementById('series-categories');
        const listContainer = document.getElementById('series-list');
        const backButton = document.getElementById('back-to-series-categories');
        
        // Hide categories, show list immediately
        categoriesContainer.style.display = 'none';
        listContainer.style.display = 'flex';
        backButton.classList.remove('d-none');
        
        // Clear container immediately
        listContainer.innerHTML = '';
        
        // Use requestAnimationFrame to ensure UI updates first, then add content
        requestAnimationFrame(() => {
            // Add series in small batches to prevent blocking
            this.renderContentInBatches(listContainer, this.series, 'serie');
        });
    }

    renderContentInBatches(container, items, type, batchSize = 8, startIndex = 0) {
        const endIndex = Math.min(startIndex + batchSize, items.length);
        
        // Remove any existing loading indicator
        const existingLoader = container.querySelector('.batch-loading-indicator');
        if (existingLoader) {
            existingLoader.remove();
        }
        
        // Add current batch
        for (let i = startIndex; i < endIndex; i++) {
            const element = this.createContentItem(items[i], type);
            container.appendChild(element);
        }
        
        // If there are more items, show loading indicator and schedule next batch
        if (endIndex < items.length) {
            // Add loading indicator
            const loader = document.createElement('div');
            loader.className = 'col-12 text-center batch-loading-indicator';
            loader.innerHTML = `
                <div class="d-flex justify-content-center align-items-center p-3">
                    <div class="spinner-border spinner-border-sm text-warning me-2" role="status">
                        <span class="visually-hidden">Carregando...</span>
                    </div>
                    <small class="text-muted">Carregando mais itens... (${endIndex}/${items.length})</small>
                </div>
            `;
            container.appendChild(loader);
            
            // Use setTimeout for better performance than requestAnimationFrame for subsequent batches
            setTimeout(() => {
                this.renderContentInBatches(container, items, type, batchSize, endIndex);
            }, 50);
        } else {
            // All items loaded, show completion message briefly
            const completionMsg = document.createElement('div');
            completionMsg.className = 'col-12 text-center batch-loading-indicator';
            completionMsg.innerHTML = `
                <div class="d-flex justify-content-center align-items-center p-2">
                    <i class="fas fa-check-circle text-success me-2"></i>
                    <small class="text-success">Todos os ${items.length} itens carregados!</small>
                </div>
            `;
            container.appendChild(completionMsg);
            
            // Remove completion message after 2 seconds
            setTimeout(() => {
                if (completionMsg.parentNode) {
                    completionMsg.remove();
                }
            }, 2000);
        }
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
                    ${item.logo ? 
                        `<div class="lazy-image-container" style="height: 200px; position: relative;">
                            <div class="lazy-placeholder bg-secondary d-flex align-items-center justify-content-center" style="height: 200px; position: absolute; width: 100%; z-index: 1;">
                                <div class="spinner-border text-light" role="status" style="width: 1.5rem; height: 1.5rem;">
                                    <span class="visually-hidden">Carregando...</span>
                                </div>
                            </div>
                            <img data-src="${item.logo}" class="card-img-top lazy-image" alt="${item.name}" style="height: 200px; object-fit: cover; position: relative; z-index: 2; opacity: 0; transition: opacity 0.3s ease;" onerror="this.parentElement.querySelector('.lazy-placeholder').innerHTML='<i class=&quot;fas fa-tv fa-3x text-muted&quot;></i>';">
                        </div>` 
                        : '<div class="card-img-top bg-secondary d-flex align-items-center justify-content-center" style="height: 200px;"><i class="fas fa-tv fa-3x text-muted"></i></div>'}
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

        div.querySelector('.content-item').addEventListener('click', async (e) => {
            // Don't trigger if clicked on buttons
            if (e.target.closest('button')) return;
            
            // Prevent multiple clicks during loading
            const contentItem = e.currentTarget;
            if (contentItem.classList.contains('loading-state')) return;
            
            if (type === 'serie') {
                // Add loading state to clicked item
                contentItem.classList.add('loading-state');
                try {
                    await this.showSerieEpisodes(item);
                } finally {
                    contentItem.classList.remove('loading-state');
                }
            } else if (type === 'movie') {
                // Add loading state and show loading for movies
                contentItem.classList.add('loading-state');
                this.showItemLoading(item.name, 'movie');
                try {
                    await this.playContent(item);
                } catch (error) {
                    console.error('Error loading movie:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro ao Carregar Filme',
                        text: `Erro ao carregar "${item.name}". Tente novamente.`,
                        background: '#1e3c72',
                        color: '#ffffff',
                        confirmButtonColor: '#ffd700'
                    });
                } finally {
                    this.showContentLoading(false);
                    contentItem.classList.remove('loading-state');
                }
            } else {
                // For channels, show brief loading indicator
                contentItem.classList.add('loading-state');
                try {
                    await this.playContent(item);
                } finally {
                    contentItem.classList.remove('loading-state');
                }
            }
        });

        // Setup lazy loading for images
        this.setupLazyLoading(div);

        return div;
    }

    setupLazyLoading(element) {
        const lazyImages = element.querySelectorAll('.lazy-image');
        
        if (lazyImages.length === 0) return;

        // Create intersection observer if it doesn't exist
        if (!this.lazyImageObserver) {
            const options = {
                root: null,
                rootMargin: '50px',
                threshold: 0.1
            };

            this.lazyImageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadLazyImage(entry.target);
                        this.lazyImageObserver.unobserve(entry.target);
                    }
                });
            }, options);
        }

        // Observe each lazy image
        lazyImages.forEach(img => {
            this.lazyImageObserver.observe(img);
        });
    }

    loadLazyImage(img) {
        const container = img.parentElement;
        const placeholder = container.querySelector('.lazy-placeholder');
        const dataSrc = img.getAttribute('data-src');

        if (!dataSrc) return;

        // Add shimmer effect to placeholder while loading
        if (placeholder) {
            placeholder.classList.add('shimmer');
            placeholder.innerHTML = `
                <div class="d-flex flex-column align-items-center justify-content-center h-100">
                    <div class="spinner-border text-warning mb-2" role="status" style="width: 1.2rem; height: 1.2rem;">
                        <span class="visually-hidden">Carregando imagem...</span>
                    </div>
                    <small class="text-muted">Carregando...</small>
                </div>
            `;
        }

        // Create a new image to preload
        const newImg = new Image();
        
        newImg.onload = () => {
            // Image loaded successfully
            img.src = dataSrc;
            img.setAttribute('data-loaded', 'true');
            img.style.opacity = '1';
            
            // Hide placeholder after image transition
            setTimeout(() => {
                if (placeholder) {
                    placeholder.style.opacity = '0';
                    setTimeout(() => {
                        placeholder.style.display = 'none';
                    }, 200);
                }
            }, 400);
        };

        newImg.onerror = () => {
            // Image failed to load
            img.setAttribute('data-error', 'true');
            if (placeholder) {
                placeholder.classList.remove('shimmer');
                placeholder.innerHTML = `
                    <div class="d-flex flex-column align-items-center justify-content-center h-100">
                        <i class="fas fa-image fa-2x text-muted mb-2"></i>
                        <small class="text-muted">Imagem não disponível</small>
                    </div>
                `;
                placeholder.style.background = 'linear-gradient(135deg, #2a2a2a, #1a1a1a)';
            }
        };

        // Start loading the image
        newImg.src = dataSrc;
    }

    async showSerieEpisodes(serie) {
        if (this.connectionType === 'xtream') {
            const { url, username, password } = this.connectionData;
            
            console.log('Loading series episodes for:', serie);
            
            // Show loading when fetching series details
            this.showItemLoading(serie.name, 'series');
            
            try {
                const apiUrl = `${url}/player_api.php?username=${username}&password=${password}&action=get_series_info&series_id=${serie.series_id}`;
                console.log('Fetching series info from:', apiUrl);
                
                const response = await this.fetchWithCORS(apiUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const serieInfo = await response.json();
                console.log('Series info response:', serieInfo);
                
                // Check if the response contains error or is empty
                if (!serieInfo || (serieInfo.error && serieInfo.error !== false)) {
                    throw new Error('Invalid series data received from server');
                }
                
                // Debug: log the complete series info structure
                this.debugSeriesInfo(serieInfo, serie);
                
                // Show detailed series screen
                this.showSeriesDetailsScreen(serieInfo, serie);
            } catch (error) {
                console.error('Error loading episodes:', error);
                
                let errorMessage = `Erro ao carregar os episódios de "${serie.name}".`;
                
                if (error.message.includes('HTTP 404')) {
                    errorMessage += ' A série não foi encontrada no servidor.';
                } else if (error.message.includes('HTTP 401')) {
                    errorMessage += ' Erro de autenticação. Verifique suas credenciais.';
                } else if (error.message.includes('HTTP 403')) {
                    errorMessage += ' Acesso negado a esta série.';
                } else if (error.message.includes('Invalid series data')) {
                    errorMessage += ' Dados da série inválidos ou corrompidos.';
                } else {
                    errorMessage += ' Verifique sua conexão e tente novamente.';
                }
                
                Swal.fire({
                    icon: 'error',
                    title: 'Erro ao Carregar Série',
                    text: errorMessage,
                    background: '#1e3c72',
                    color: '#ffffff',
                    confirmButtonColor: '#ffd700',
                    footer: `<small>Série ID: ${serie.series_id}</small>`
                });
            } finally {
                this.showContentLoading(false);
            }
        }
    }

    showSeriesDetailsScreen(serieInfo, serie) {
        console.log('Showing series details:', { serieInfo, serie });
        
        // Store current series data
        this.currentSeriesInfo = serieInfo;
        this.currentSeries = serie;
        
        // Extract series information with fallbacks (prioritize serieInfo.info)
        const seriesName = serieInfo.info?.name || serie.name || 'Série sem nome';
        const seriesYear = serieInfo.info?.releaseDate || serie.year || 'N/A';
        const seriesRating = serieInfo.info?.rating_5based || serieInfo.info?.rating || serie.rating;
        const seriesPlot = serieInfo.info?.plot || serie.plot || 'Descrição não disponível.';
        const seriesLogo = serieInfo.info?.cover || serie.logo || serie.cover;
        
        // Update series information
        document.getElementById('series-name').textContent = seriesName;
        document.getElementById('series-year').textContent = seriesYear;
        
        // Format rating
        if (seriesRating && seriesRating > 0) {
            const rating = parseFloat(seriesRating);
            const stars = Math.floor(rating);
            const starsDisplay = '⭐'.repeat(Math.min(stars, 5));
            document.getElementById('series-rating').innerHTML = `${starsDisplay} ${rating}/5`;
        } else {
            document.getElementById('series-rating').innerHTML = 'Sem avaliação';
        }
        
        // Set poster image
        const posterImg = document.getElementById('series-poster');
        if (seriesLogo) {
            posterImg.src = seriesLogo;
            posterImg.style.display = 'block';
            posterImg.onerror = function() {
                this.style.display = 'none';
                console.warn('Failed to load series poster:', seriesLogo);
            };
        } else {
            posterImg.style.display = 'none';
        }
        
        // Set plot/description
        document.getElementById('series-plot').textContent = seriesPlot;
        
        // Add additional series information if available
        this.displayAdditionalSeriesInfo(serieInfo);
        
        // Process seasons and episodes
        const seasons = this.processSeriesSeasons(serieInfo);
        
        // Update seasons count
        const seasonsCount = seasons.length || 0;
        document.getElementById('series-seasons-count').textContent = seasonsCount;
        
        // Calculate total episodes
        let totalEpisodes = 0;
        if (seasons.length > 0) {
            totalEpisodes = seasons.reduce((total, season) => total + (season.episodes?.length || season.episode_count || 0), 0);
        } else if (serieInfo.episodes) {
            // Fallback: count episodes directly from episodes data
            totalEpisodes = Object.values(serieInfo.episodes).reduce((total, seasonEpisodes) => {
                if (Array.isArray(seasonEpisodes)) {
                    return total + seasonEpisodes.length;
                } else if (typeof seasonEpisodes === 'object') {
                    return total + Object.keys(seasonEpisodes).length;
                }
                return total;
            }, 0);
        }
        document.getElementById('series-episodes-count').textContent = totalEpisodes;
        
        // Handle case where no seasons/episodes were found
        if (seasons.length === 0) {
            console.warn('No seasons found for series:', seriesName);
            
            // Check if there's any episodes data at all
            const hasAnyEpisodes = serieInfo.episodes && Object.keys(serieInfo.episodes).length > 0;
            
            // Show message instead of empty content
            document.getElementById('seasons-selector').innerHTML = `
                <div class="alert alert-warning text-dark">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Nenhuma temporada encontrada para esta série.
                    ${hasAnyEpisodes ? '<br><small>Dados de episódios detectados mas não foi possível processá-los.</small>' : ''}
                </div>
            `;
            
            document.getElementById('episodes-container').innerHTML = `
                <div class="text-center text-white-50 p-5">
                    <i class="fas fa-tv fa-3x mb-3 text-muted"></i>
                    <h5>Nenhum episódio disponível</h5>
                    <p>Esta série não possui episódios disponíveis ou os dados não foram carregados corretamente.</p>
                    ${hasAnyEpisodes ? '<p><small class="text-muted">Debug: Existe dados de episódios, mas houve erro no processamento.</small></p>' : ''}
                    <button class="btn btn-outline-warning mt-3" onclick="location.reload()">
                        <i class="fas fa-refresh me-1"></i>Recarregar Página
                    </button>
                </div>
            `;
            
            document.getElementById('current-season-title').textContent = 'Sem episódios disponíveis';
        } else {
            // Create seasons selector
            this.createSeasonsSelector(seasons);
            
            // Show first season by default
            this.showSeasonEpisodes(seasons[0], 0);
        }
        
        // Navigate to series details screen
        this.showScreen('series-details-screen');
    }

    processSeriesSeasons(serieInfo) {
        console.log('Processing series seasons:', serieInfo);
        const seasons = [];
        
        // First, check if we have season metadata in serieInfo.seasons (array format)
        if (serieInfo.seasons && Array.isArray(serieInfo.seasons) && serieInfo.seasons.length > 0) {
            console.log('Found seasons metadata (array format):', serieInfo.seasons);
            
            // Process season metadata
            serieInfo.seasons.forEach(seasonInfo => {
                const season = {
                    number: seasonInfo.season_number,
                    name: seasonInfo.name || `Temporada ${seasonInfo.season_number}`,
                    episode_count: seasonInfo.episode_count || 0,
                    air_date: seasonInfo.air_date,
                    overview: seasonInfo.overview,
                    cover: seasonInfo.cover || seasonInfo.cover_big,
                    episodes: [] // Will be populated later when requested
                };
                seasons.push(season);
            });
            
            // Sort seasons by number
            seasons.sort((a, b) => a.number - b.number);
            console.log('Processed seasons from metadata:', seasons);
            return seasons;
        }
        
        // If seasons is empty or not available, extract seasons from episodes data
        if (!serieInfo.seasons || (Array.isArray(serieInfo.seasons) && serieInfo.seasons.length === 0)) {
            console.log('Seasons metadata is empty, extracting seasons from episodes data');
            
            if (serieInfo.episodes && Object.keys(serieInfo.episodes).length > 0) {
                console.log('Available episode seasons:', Object.keys(serieInfo.episodes));
            } else {
                console.warn('No episodes data available either');
                return seasons; // Return empty array
            }
        }
        
        // Check for episodes data structure in serieInfo.episodes
        if (serieInfo.episodes && typeof serieInfo.episodes === 'object') {
            console.log('Found episodes data structure:', serieInfo.episodes);
            
            // Process episodes organized by season number
            Object.keys(serieInfo.episodes).forEach(seasonKey => {
                const seasonNumber = parseInt(seasonKey);
                const episodesInSeason = serieInfo.episodes[seasonKey];
                
                console.log(`Processing season ${seasonNumber} with episodes:`, episodesInSeason);
                
                // Find corresponding season metadata if available
                let seasonMetadata = seasons.find(s => s.number === seasonNumber);
                
                // Create season object if not found in metadata
                if (!seasonMetadata) {
                    // Extract additional info from first episode of the season if available
                    let seasonInfo = {
                        number: seasonNumber,
                        name: `Temporada ${seasonNumber}`,
                        episode_count: 0,
                        episodes: []
                    };
                    
                    // Try to extract additional season info from episodes
                    if (Array.isArray(episodesInSeason) && episodesInSeason.length > 0) {
                        const firstEpisode = episodesInSeason[0];
                        
                        // Sometimes episodes contain season info
                        if (firstEpisode.info && firstEpisode.info.season_name) {
                            seasonInfo.name = firstEpisode.info.season_name;
                        }
                        
                        // Extract air date from first episode if available
                        if (firstEpisode.info && firstEpisode.info.releasedate) {
                            seasonInfo.air_date = firstEpisode.info.releasedate;
                        }
                        
                        // Set episode count based on actual episodes found
                        seasonInfo.episode_count = episodesInSeason.length;
                    } else if (typeof episodesInSeason === 'object') {
                        seasonInfo.episode_count = Object.keys(episodesInSeason).length;
                    }
                    
                    seasonMetadata = seasonInfo;
                    seasons.push(seasonMetadata);
                    console.log(`Created season ${seasonNumber} from episodes data:`, seasonMetadata);
                }
                
                // Process episodes for this season (episodes are in an array)
                if (Array.isArray(episodesInSeason)) {
                    episodesInSeason.forEach(episode => {
                        const episodeData = this.createEpisodeObject(episode, seasonNumber);
                        seasonMetadata.episodes.push(episodeData);
                    });
                } else if (typeof episodesInSeason === 'object') {
                    // Fallback for object format (legacy support)
                    Object.values(episodesInSeason).forEach(episode => {
                        const episodeData = this.createEpisodeObject(episode, seasonNumber);
                        seasonMetadata.episodes.push(episodeData);
                    });
                }
                
                // Update episode count with actual loaded episodes
                seasonMetadata.episode_count = seasonMetadata.episodes.length;
                
                // Sort episodes by number
                seasonMetadata.episodes.sort((a, b) => a.number - b.number);
                
                // Update season info based on episodes (if no metadata was available)
                if (seasonMetadata.episodes.length > 0 && !seasonMetadata.air_date) {
                    const episodesWithDates = seasonMetadata.episodes.filter(ep => ep.release_date);
                    if (episodesWithDates.length > 0) {
                        // Use the earliest episode date as season air date
                        const earliestEpisode = episodesWithDates.reduce((earliest, current) => {
                            return new Date(earliest.release_date) < new Date(current.release_date) ? earliest : current;
                        });
                        seasonMetadata.air_date = earliestEpisode.release_date;
                    }
                }
            });
            
            // Sort seasons by number
            seasons.sort((a, b) => a.number - b.number);
        }
        
        console.log('Processed seasons:', seasons);
        return seasons;
    }

    processEpisode(episode, seasonMap) {
        if (!episode || typeof episode !== 'object') {
            console.warn('Invalid episode data:', episode);
            return;
        }
        
        // Extract season number with multiple fallbacks
        let seasonNum = 1;
        if (episode.season_number) {
            seasonNum = parseInt(episode.season_number);
        } else if (episode.season) {
            seasonNum = parseInt(episode.season);
        } else if (episode.seasonNumber) {
            seasonNum = parseInt(episode.seasonNumber);
        }
        
        // Fallback if parsing failed
        if (isNaN(seasonNum) || seasonNum < 1) {
            seasonNum = 1;
        }
        
        // Extract episode number with multiple fallbacks
        let episodeNum = 1;
        if (episode.episode_num) {
            episodeNum = parseInt(episode.episode_num);
        } else if (episode.episode) {
            episodeNum = parseInt(episode.episode);
        } else if (episode.episodeNumber) {
            episodeNum = parseInt(episode.episodeNumber);
        }
        
        // Fallback if parsing failed
        if (isNaN(episodeNum) || episodeNum < 1) {
            episodeNum = 1;
        }
        
        // Create season if it doesn't exist
        if (!seasonMap.has(seasonNum)) {
            seasonMap.set(seasonNum, {
                number: seasonNum,
                name: `Temporada ${seasonNum}`,
                episodes: []
            });
        }
        
        // Extract episode title with fallbacks
        let episodeTitle = episode.title || episode.name || `Episódio ${episodeNum}`;
        
        // Extract additional info
        const episodeInfo = episode.info || {};
        
        // Build episode object
        const episodeData = {
            id: episode.id || episode.stream_id,
            number: episodeNum,
            title: episodeTitle,
            plot: episode.plot || episode.description || episodeInfo.plot || '',
            duration: episodeInfo.duration || episode.duration || '',
            rating: episodeInfo.rating || episode.rating || '',
            release_date: episodeInfo.release_date || episode.added || '',
            container_extension: episode.container_extension || 'mp4',
            url: `${this.connectionData.url}/series/${this.connectionData.username}/${this.connectionData.password}/${episode.id || episode.stream_id}.${episode.container_extension || 'mp4'}`
        };
        
        console.log(`Adding episode S${seasonNum}E${episodeNum}: ${episodeTitle}`, episodeData);
        
        seasonMap.get(seasonNum).episodes.push(episodeData);
    }

    debugSeriesInfo(serieInfo, serie) {
        console.group('🔍 SERIES DEBUG INFO');
        console.log('Serie object:', serie);
        console.log('SerieInfo object:', serieInfo);
        
        if (serieInfo) {
            console.log('SerieInfo keys:', Object.keys(serieInfo));
            
            if (serieInfo.info) {
                console.log('SerieInfo.info:', serieInfo.info);
                console.log('Available info fields:', Object.keys(serieInfo.info));
                
                // Log important fields
                console.log('Series Name:', serieInfo.info.name);
                console.log('Plot:', serieInfo.info.plot);
                console.log('Genre:', serieInfo.info.genre);
                console.log('Cast:', serieInfo.info.cast);
                console.log('Rating (5-based):', serieInfo.info.rating_5based);
                console.log('Episode Runtime:', serieInfo.info.episode_run_time);
                console.log('Cover Image:', serieInfo.info.cover);
                console.log('Backdrop Images:', serieInfo.info.backdrop_path);
            }
            
            if (serieInfo.seasons) {
                console.log('SerieInfo.seasons structure:', serieInfo.seasons);
                
                if (Array.isArray(serieInfo.seasons)) {
                    console.log('Seasons is an array with length:', serieInfo.seasons.length);
                    if (serieInfo.seasons.length > 0) {
                        console.log('First season sample:', serieInfo.seasons[0]);
                        console.log('Season fields:', Object.keys(serieInfo.seasons[0]));
                    }
                } else {
                    console.log('SerieInfo.seasons keys:', Object.keys(serieInfo.seasons));
                
                    // Log first season structure
                    const firstSeasonKey = Object.keys(serieInfo.seasons)[0];
                    if (firstSeasonKey) {
                        console.log('First season key:', firstSeasonKey);
                        console.log('First season data:', serieInfo.seasons[firstSeasonKey]);
                        
                        const firstSeason = serieInfo.seasons[firstSeasonKey];
                        if (typeof firstSeason === 'object' && firstSeason !== null) {
                            const seasonKeys = Object.keys(firstSeason);
                            console.log('First season keys:', seasonKeys);
                            
                            // Log first episode structure
                            const firstEpisodeKey = seasonKeys[0];
                            if (firstEpisodeKey) {
                                console.log('First episode key:', firstEpisodeKey);
                                console.log('First episode data:', firstSeason[firstEpisodeKey]);
                            }
                        }
                    }
                }
            }
            
            if (serieInfo.episodes) {
                console.log('SerieInfo.episodes structure:', serieInfo.episodes);
                console.log('Season keys in episodes:', Object.keys(serieInfo.episodes));
                
                // Log first season's episodes structure
                const firstSeasonKey = Object.keys(serieInfo.episodes)[0];
                if (firstSeasonKey) {
                    const seasonEpisodes = serieInfo.episodes[firstSeasonKey];
                    console.log(`Episodes in season ${firstSeasonKey}:`, seasonEpisodes);
                    
                    if (Array.isArray(seasonEpisodes)) {
                        console.log(`Season ${firstSeasonKey} has ${seasonEpisodes.length} episodes (array format)`);
                        
                        // Log first episode structure
                        if (seasonEpisodes.length > 0) {
                            console.log('First episode sample:', seasonEpisodes[0]);
                            console.log('Episode fields:', Object.keys(seasonEpisodes[0]));
                            
                            // Log episode info structure
                            if (seasonEpisodes[0].info) {
                                console.log('Episode info fields:', Object.keys(seasonEpisodes[0].info));
                                if (seasonEpisodes[0].info.video) {
                                    console.log('Video info:', {
                                        resolution: `${seasonEpisodes[0].info.video.width}x${seasonEpisodes[0].info.video.height}`,
                                        bitrate: seasonEpisodes[0].info.video.bit_rate,
                                        codec: seasonEpisodes[0].info.video.codec_name
                                    });
                                }
                            }
                        }
                    } else {
                        console.log(`Number of episodes in season ${firstSeasonKey}:`, Object.keys(seasonEpisodes).length);
                        
                        // Log first episode structure (object format)
                        const firstEpisodeKey = Object.keys(seasonEpisodes)[0];
                        if (firstEpisodeKey) {
                            console.log('First episode sample:', seasonEpisodes[firstEpisodeKey]);
                            console.log('Episode fields:', Object.keys(seasonEpisodes[firstEpisodeKey]));
                        }
                    }
                }
            }
        }
        
        console.groupEnd();
    }

    displayAdditionalSeriesInfo(serieInfo) {
        if (!serieInfo.info) return;
        
        const info = serieInfo.info;
        
        // Find the series info container or create additional info section
        const seriesInfoContainer = document.getElementById('series-info');
        
        // Remove any existing additional info
        const existingAdditionalInfo = document.getElementById('additional-series-info');
        if (existingAdditionalInfo) {
            existingAdditionalInfo.remove();
        }
        
        // Create additional info section
        const additionalInfoDiv = document.createElement('div');
        additionalInfoDiv.id = 'additional-series-info';
        additionalInfoDiv.className = 'mt-3 pt-3 border-top border-secondary';
        
        let additionalInfoHTML = '';
        
        // Genre
        if (info.genre) {
            additionalInfoHTML += `
                <div class="mb-2">
                    <small class="text-muted">Gênero:</small>
                    <span class="text-white ms-2">${info.genre}</span>
                </div>
            `;
        }
        
        // Cast
        if (info.cast) {
            additionalInfoHTML += `
                <div class="mb-2">
                    <small class="text-muted">Elenco:</small>
                    <span class="text-white-50 ms-2 small">${info.cast}</span>
                </div>
            `;
        }
        
        // Director
        if (info.director && info.director.trim() !== '') {
            additionalInfoHTML += `
                <div class="mb-2">
                    <small class="text-muted">Diretor:</small>
                    <span class="text-white ms-2">${info.director}</span>
                </div>
            `;
        }
        
        // Episode runtime
        if (info.episode_run_time) {
            additionalInfoHTML += `
                <div class="mb-2">
                    <small class="text-muted">Duração do Episódio:</small>
                    <span class="text-white ms-2">${info.episode_run_time} min</span>
                </div>
            `;
        }
        
        // Rating details
        if (info.rating_5based && info.rating) {
            additionalInfoHTML += `
                <div class="mb-2">
                    <small class="text-muted">Nota Detalhada:</small>
                    <span class="text-warning ms-2">${info.rating_5based}/5 (${info.rating}/10)</span>
                </div>
            `;
        }
        
        // Last modified (when series was last updated)
        if (info.last_modified) {
            const lastModified = new Date(parseInt(info.last_modified) * 1000);
            additionalInfoHTML += `
                <div class="mb-2">
                    <small class="text-muted">Última Atualização:</small>
                    <span class="text-white-50 ms-2 small">${lastModified.toLocaleDateString('pt-BR')}</span>
                </div>
            `;
        }
        
        // YouTube trailer button
        if (info.youtube_trailer && info.youtube_trailer.trim() !== '') {
            additionalInfoHTML += `
                <div class="mt-3">
                    <button class="btn btn-danger btn-sm" onclick="window.open('${info.youtube_trailer}', '_blank')">
                        <i class="fab fa-youtube me-1"></i>Assistir Trailer
                    </button>
                </div>
            `;
        }
        
        if (additionalInfoHTML) {
            additionalInfoDiv.innerHTML = additionalInfoHTML;
            seriesInfoContainer.appendChild(additionalInfoDiv);
        }
        
        // Set backdrop image if available
        this.setSeriesBackdrop(info);
    }

    setSeriesBackdrop(info) {
        if (info.backdrop_path && Array.isArray(info.backdrop_path) && info.backdrop_path.length > 0) {
            const backdropUrl = info.backdrop_path[0];
            
            // Apply backdrop to the series details screen
            const seriesScreen = document.getElementById('series-details-screen');
            if (seriesScreen) {
                seriesScreen.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url('${backdropUrl}')`;
                seriesScreen.style.backgroundSize = 'cover';
                seriesScreen.style.backgroundPosition = 'center';
                seriesScreen.style.backgroundRepeat = 'no-repeat';
                seriesScreen.style.backgroundAttachment = 'fixed';
            }
        }
    }

    async loadSeasonEpisodes(season) {
        if (this.connectionType !== 'xtream') {
            throw new Error('Only Xtream connections support dynamic episode loading');
        }
        
        const { url, username, password } = this.connectionData;
        const seriesId = this.currentSeries.series_id;
        
        console.log(`Loading episodes for season ${season.number} of series ${seriesId}`);
        
        try {
            // Try to get episodes for this specific season
            const apiUrl = `${url}/player_api.php?username=${username}&password=${password}&action=get_series_info&series_id=${seriesId}`;
            console.log('Fetching detailed series info for episodes:', apiUrl);
            
            const response = await this.fetchWithCORS(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const detailedSerieInfo = await response.json();
            console.log('Detailed series info for episodes:', detailedSerieInfo);
            
            // Look for episodes in the episodes structure organized by season number
            const episodes = [];
            
            if (detailedSerieInfo.episodes) {
                // Episodes are organized by season number as keys ("1", "2", "3", etc.)
                const seasonKey = season.number.toString();
                console.log(`Looking for episodes in season key: ${seasonKey}`);
                
                if (detailedSerieInfo.episodes[seasonKey]) {
                    const seasonEpisodes = detailedSerieInfo.episodes[seasonKey];
                    console.log(`Found episodes for season ${seasonKey}:`, seasonEpisodes);
                    
                    // Process all episodes in this season
                    if (Array.isArray(seasonEpisodes)) {
                        // Episodes are in array format
                        seasonEpisodes.forEach(episode => {
                            episodes.push(this.createEpisodeObject(episode, season.number));
                        });
                    } else if (typeof seasonEpisodes === 'object') {
                        // Episodes are in object format (fallback)
                        Object.values(seasonEpisodes).forEach(episode => {
                            episodes.push(this.createEpisodeObject(episode, season.number));
                        });
                    }
                } else {
                    console.warn(`No episodes found for season key ${seasonKey}`);
                    console.log('Available season keys:', Object.keys(detailedSerieInfo.episodes));
                }
            } else {
                console.warn('No episodes structure found in detailedSerieInfo');
            }
            
            // Sort episodes by episode number
            episodes.sort((a, b) => a.number - b.number);
            
            // Update season with loaded episodes
            season.episodes = episodes;
            
            console.log(`Loaded ${episodes.length} episodes for season ${season.number}`);
            
            if (episodes.length === 0) {
                throw new Error(`No episodes found for season ${season.number}`);
            }
            
        } catch (error) {
            console.error('Error loading season episodes:', error);
            throw error;
        }
    }

    createEpisodeObject(episode, seasonNumber) {
        const episodeNum = parseInt(episode.episode_num) || parseInt(episode.episode) || 1;
        const episodeInfo = episode.info || {};
        
        // Extract episode title, removing series prefix if present
        let episodeTitle = episode.title || episode.name || `Episódio ${episodeNum}`;
        
        // Clean up title - remove series name pattern (e.g., "Elementary - S01E01 - Episódio 1" → "Episódio 1")
        if (episodeTitle.includes(' - ') && episodeTitle.includes(`S${seasonNumber.toString().padStart(2, '0')}E${episodeNum.toString().padStart(2, '0')}`)) {
            const parts = episodeTitle.split(' - ');
            if (parts.length >= 3) {
                episodeTitle = parts[parts.length - 1]; // Get last part
            }
        }
        
        // Extract additional info from episode.info
        const plot = episodeInfo.plot || episode.plot || episode.description || '';
        const duration = episodeInfo.duration || episode.duration || '';
        const rating = episodeInfo.rating || episode.rating || '';
        const releaseDate = episodeInfo.releasedate || episodeInfo.release_date || episode.added || '';
        const movieImage = episodeInfo.movie_image || '';
        
        // Convert added timestamp to readable date
        let formattedDate = '';
        if (episode.added && !isNaN(episode.added)) {
            formattedDate = new Date(parseInt(episode.added) * 1000).toLocaleDateString('pt-BR');
        } else if (releaseDate) {
            formattedDate = new Date(releaseDate).toLocaleDateString('pt-BR');
        }
        
        // Extract video quality info
        let qualityInfo = '';
        if (episodeInfo.video) {
            const video = episodeInfo.video;
            qualityInfo = `${video.width}x${video.height}`;
            if (video.bit_rate) {
                const bitrateMbps = Math.round(parseInt(video.bit_rate) / 1000000 * 100) / 100;
                qualityInfo += ` • ${bitrateMbps} Mbps`;
            }
        }
        
        return {
            id: episode.id || episode.stream_id,
            number: episodeNum,
            title: episodeTitle,
            plot: plot,
            duration: duration,
            duration_secs: episodeInfo.duration_secs || 0,
            rating: rating,
            release_date: formattedDate,
            movie_image: movieImage,
            quality_info: qualityInfo,
            container_extension: episode.container_extension || 'mp4',
            season: seasonNumber,
            url: `${this.connectionData.url}/series/${this.connectionData.username}/${this.connectionData.password}/${episode.id || episode.stream_id}.${episode.container_extension || 'mp4'}`
        };
    }

    createSeasonsSelector(seasons) {
        const container = document.getElementById('seasons-selector');
        container.innerHTML = '';
        
        if (!seasons || seasons.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info text-dark">
                    <i class="fas fa-info-circle me-2"></i>
                    Nenhuma temporada disponível
                </div>
            `;
            return;
        }
        
        seasons.forEach((season, index) => {
            // Use episode_count from metadata if available, or actual episodes length
            const episodeCount = season.episode_count || (season.episodes ? season.episodes.length : 0);
            const button = document.createElement('button');
            button.className = `btn btn-outline-warning ${index === 0 ? 'active' : ''}`;
            
            // Show episode count from metadata or actual count
            if (season.episode_count) {
                button.textContent = `T${season.number} (${season.episode_count} ep.)`;
            } else {
                button.textContent = `T${season.number} (${episodeCount} ep.)`;
            }
            
            // Add air date to title if available
            if (season.air_date) {
                button.title = `${season.name || `Temporada ${season.number}`} - Estreou em ${new Date(season.air_date).toLocaleDateString('pt-BR')}`;
            }
            
            button.addEventListener('click', async () => {
                // Update active button
                container.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Show season episodes (will load if not already loaded)
                await this.showSeasonEpisodes(season, index);
            });
            
            container.appendChild(button);
        });
    }

    async showSeasonEpisodes(season, seasonIndex) {
        const container = document.getElementById('episodes-container');
        const titleElement = document.getElementById('current-season-title');
        
        // Update title with season info and additional details
        const episodeCountText = season.episode_count ? `${season.episode_count}` : `${season.episodes ? season.episodes.length : 0}`;
        let titleText = `${season.name} - ${episodeCountText} episódios`;
        
        if (season.air_date) {
            titleText += ` • Estreou em ${new Date(season.air_date).toLocaleDateString('pt-BR')}`;
        }
        
        titleElement.innerHTML = `
            <div class="d-flex align-items-center">
                ${season.cover ? `<img src="${season.cover}" alt="${season.name}" class="me-3 rounded" style="width: 60px; height: 90px; object-fit: cover;">` : ''}
                <div>
                    <h6 class="mb-0">${titleText}</h6>
                    ${season.overview && season.overview.trim() ? `<small class="text-white-50">${season.overview}</small>` : ''}
                </div>
            </div>
        `;
        
        // Clear container
        container.innerHTML = '';
        
        // Check if we have episodes for this season
        if (!season.episodes || season.episodes.length === 0) {
            // Check if we only have metadata and need to load episodes
            if (season.episode_count > 0 && this.connectionType === 'xtream') {
                container.innerHTML = `
                    <div class="text-center text-white-50 p-4">
                        <div class="spinner-border text-warning mb-3" role="status">
                            <span class="visually-hidden">Carregando...</span>
                        </div>
                        <p>Carregando episódios da ${season.name}...</p>
                    </div>
                `;
                
                try {
                    await this.loadSeasonEpisodes(season);
                    // Refresh the display after loading
                    await this.showSeasonEpisodes(season, seasonIndex);
                    return;
                } catch (error) {
                    console.error('Error loading season episodes:', error);
                    container.innerHTML = `
                        <div class="text-center text-white-50 p-4">
                            <i class="fas fa-exclamation-triangle fa-2x mb-3 text-warning"></i>
                            <p>Erro ao carregar episódios da ${season.name}</p>
                            <button class="btn btn-outline-warning btn-sm mt-2" onclick="location.reload()">
                                <i class="fas fa-redo me-1"></i>Recarregar Página
                            </button>
                        </div>
                    `;
                    return;
                }
            } else {
                // No episodes available or no episode count
                container.innerHTML = `
                    <div class="text-center text-white-50 p-4">
                        <i class="fas fa-exclamation-circle fa-2x mb-3"></i>
                        <p>Nenhum episódio encontrado para esta temporada.</p>
                        ${season.episode_count > 0 ? '<small class="text-muted">Os episódios podem não estar disponíveis no servidor.</small>' : ''}
                    </div>
                `;
                return;
            }
        }
        
        // Create episodes list
        season.episodes.forEach(episode => {
            const episodeDiv = document.createElement('div');
            episodeDiv.className = 'episode-item border-bottom border-secondary py-3';
            
            episodeDiv.innerHTML = `
                <div class="row align-items-center">
                    ${episode.movie_image ? `
                    <div class="col-auto">
                        <img src="${episode.movie_image}" alt="${episode.title}" class="rounded" 
                             style="width: 80px; height: 60px; object-fit: cover;"
                             onerror="this.style.display='none'">
                    </div>
                    ` : ''}
                    <div class="col-auto">
                        <div class="episode-number bg-warning text-dark fw-bold rounded-circle d-flex align-items-center justify-content-center" 
                             style="width: 40px; height: 40px; font-size: 14px;">
                            ${episode.number}
                        </div>
                    </div>
                    <div class="col">
                        <h6 class="text-white mb-1">${episode.title}</h6>
                        ${episode.plot ? `<p class="text-white-50 small mb-1">${episode.plot.substring(0, 150)}${episode.plot.length > 150 ? '...' : ''}</p>` : ''}
                        <div class="d-flex align-items-center gap-3 flex-wrap">
                            ${episode.duration ? `<small class="text-muted"><i class="fas fa-clock me-1"></i>${episode.duration}</small>` : ''}
                            ${episode.rating ? `<small class="text-warning"><i class="fas fa-star me-1"></i>${episode.rating}/10</small>` : ''}
                            ${episode.release_date ? `<small class="text-muted"><i class="fas fa-calendar me-1"></i>${episode.release_date}</small>` : ''}
                            ${episode.quality_info ? `<small class="text-info"><i class="fas fa-video me-1"></i>${episode.quality_info}</small>` : ''}
                        </div>
                    </div>
                    <div class="col-auto">
                        <button class="btn btn-warning btn-sm play-episode-btn" data-episode-url="${episode.url}" data-episode-title="${episode.title}">
                            <i class="fas fa-play me-1"></i>Assistir
                        </button>
                    </div>
                </div>
            `;
            
            // Add click event to play button
            const playBtn = episodeDiv.querySelector('.play-episode-btn');
            playBtn.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Play episode
                const episodeData = {
                    name: `${this.currentSeries.name} - T${season.number}E${episode.number} - ${episode.title}`,
                    url: episode.url,
                    plot: episode.plot
                };
                
                this.playContent(episodeData);
            });
            
            container.appendChild(episodeDiv);
        });
    }

    playContent(item) {
        // Remove any overlays that might be blocking the modal
        this.showLoading(false);
        this.showContentLoading(false);
        
        const modal = new bootstrap.Modal(document.getElementById('player-modal'));
        const video = document.getElementById('video-player');
        const title = document.getElementById('player-title');

        // Store current item for reload functionality
        this.currentItem = item;
        
        title.innerHTML = `<i class="fas fa-tv me-2"></i>${item.name}`;
        
        // Force remove any overlay elements
        document.querySelectorAll('.loading-overlay').forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none';
        });
        
        // Close any active SweetAlert
        if (window.Swal && Swal.isVisible()) {
            Swal.close();
        }
        
        // Ensure modal backdrop is clickable
        modal.show();
        
        // Add event listener to ensure modal is properly focused
        document.getElementById('player-modal').addEventListener('shown.bs.modal', () => {
            console.log('Player modal shown');
            
            // Hide navbar and sidebar completely
            const navbar = document.querySelector('.navbar');
            if (navbar) {
                navbar.style.display = 'none';
                console.log('Navbar hidden');
            }
            
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.style.display = 'none';
                console.log('Sidebar hidden');
            }
            
            // Force full opacity on modal and video
            const modal = document.getElementById('player-modal');
            const modalContent = modal.querySelector('.modal-content');
            const modalBody = modal.querySelector('.modal-body');
            const playerContainer = modal.querySelector('.player-container');
            const videoElement = document.getElementById('video-player');
            
            if (modal) modal.style.opacity = '1';
            if (modalContent) modalContent.style.opacity = '1';
            if (modalBody) modalBody.style.opacity = '1';
            if (playerContainer) playerContainer.style.opacity = '1';
            if (videoElement) {
                videoElement.style.opacity = '1';
                videoElement.style.filter = 'none';
                console.log('Video opacity forced to 1');
            }
            
            // Force focus on modal to ensure it's on top
            document.getElementById('player-modal').focus();
            
            // Remove any modal backdrop that might be causing opacity issues
            setTimeout(() => {
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.style.opacity = '0.5';
                    backdrop.style.zIndex = '99997';
                    console.log('Modal backdrop opacity adjusted');
                }
            }, 100);
            
            // Remove any remaining overlays
            document.querySelectorAll('[style*="z-index"]').forEach(el => {
                const zIndex = parseInt(el.style.zIndex);
                if (zIndex > 2000 && zIndex < 99999 && el.id !== 'player-modal') {
                    console.log('Hiding overlay element:', el);
                    el.style.display = 'none';
                }
            });
            
            // Debug: Check for elements that might be blocking
            const videoEl = document.getElementById('video-player');
            if (videoEl) {
                console.log('Video element found:', videoEl);
                const computedStyle = window.getComputedStyle(videoEl);
                console.log('Video opacity:', computedStyle.opacity);
                console.log('Video filter:', computedStyle.filter);
                console.log('Video z-index:', computedStyle.zIndex);
                
                // Force enable pointer events on video and container
                videoEl.style.pointerEvents = 'auto';
                videoEl.parentElement.style.pointerEvents = 'auto';
                
                // Check for elements on top of video
                const rect = videoEl.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const elementAtCenter = document.elementFromPoint(centerX, centerY);
                console.log('Element at video center:', elementAtCenter);
                
                // Check for modal backdrop interference
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    console.log('Modal backdrop found:', backdrop);
                    console.log('Backdrop z-index:', window.getComputedStyle(backdrop).zIndex);
                }
            }
        }, { once: true });
        
        // Show navbar and sidebar when modal is hidden
        document.getElementById('player-modal').addEventListener('hidden.bs.modal', () => {
            const navbar = document.querySelector('.navbar');
            if (navbar) {
                navbar.style.display = '';
                console.log('Navbar restored');
            }
            
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.style.display = '';
                console.log('Sidebar restored');
            }
        });

        // Destroy existing players
        if (this.currentPlayer) {
            this.currentPlayer.destroy();
            this.currentPlayer = null;
        }
        if (this.plyrPlayer) {
            this.plyrPlayer.destroy();
            this.plyrPlayer = null;
        }

        // Reset video element
        video.src = '';
        video.load();

        // Initialize HLS without Plyr for better compatibility
        if (Hls.isSupported()) {
            this.currentPlayer = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90,
                maxBufferLength: 30,
                maxMaxBufferLength: 60
            });
            
            this.currentPlayer.loadSource(item.url);
            this.currentPlayer.attachMedia(video);
            
            this.currentPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('HLS manifest parsed, starting playback');
                // Force autoplay
                video.muted = true; // Required for autoplay in many browsers
                video.play().then(() => {
                    console.log('Video started playing');
                    // Unmute after a short delay
                    setTimeout(() => {
                        video.muted = false;
                    }, 1000);
                }).catch(e => {
                    console.log('Autoplay prevented:', e);
                    // Show play button or notification
                    this.showPlayButton();
                });
            });

            this.currentPlayer.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS Error:', data);
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('Network error, trying to recover...');
                            this.currentPlayer.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('Media error, trying to recover...');
                            this.currentPlayer.recoverMediaError();
                            break;
                        default:
                            console.log('Fatal error, cannot recover');
                            this.handlePlayerError(item);
                            break;
                    }
                }
            });
            
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = item.url;
            video.muted = true;
            video.play().then(() => {
                console.log('Native HLS started playing');
                setTimeout(() => {
                    video.muted = false;
                }, 1000);
            }).catch(e => {
                console.log('Autoplay prevented:', e);
                this.showPlayButton();
            });
        } else {
            // Try direct playback
            video.src = item.url;
            video.muted = true;
            video.play().then(() => {
                console.log('Direct playback started');
                setTimeout(() => {
                    video.muted = false;
                }, 1000);
            }).catch(e => {
                console.log('Direct playback failed:', e);
                this.showPlayButton();
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
        const icon = document.getElementById('fullscreen-icon');
        
        if (!document.fullscreenElement) {
            // Enter fullscreen on video element
            if (video.requestFullscreen) {
                video.requestFullscreen();
            } else if (video.webkitRequestFullscreen) {
                video.webkitRequestFullscreen();
            } else if (video.msRequestFullscreen) {
                video.msRequestFullscreen();
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

        // Show content loading
        const sectionNames = {
            'channels': 'Canais',
            'movies': 'Filmes', 
            'series': 'Séries',
            'epg': 'Guia TV'
        };
        
        this.showContentLoading(true, `Carregando ${sectionNames[section]}...`, 'Preparando conteúdo...');

        // Update content sections
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
            sec.style.display = 'none';
        });
        const targetSection = document.getElementById(`${section}-section`);
        targetSection.classList.add('active');
        targetSection.style.display = 'block';

        this.currentSection = section;

        try {
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
        } catch (error) {
            console.error(`Error loading ${section}:`, error);
            this.showContentLoading(false);
            Swal.fire({
                icon: 'error',
                title: 'Erro ao Carregar',
                text: `Erro ao carregar ${sectionNames[section]}. Tente novamente.`,
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700'
            });
            return;
        }

        this.showContentLoading(false);
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

    async refreshContent() {
        this.showContentLoading(true, 'Atualizando Conteúdo...', 'Recarregando dados do servidor...');
        
        try {
            // Reload content based on connection type
            if (this.connectionType === 'xtream') {
                await this.loadXtreamCategories();
                this.displayInitialContent();
            } else if (this.connectionType === 'm3u') {
                if (this.connectionData.url) {
                    const response = await this.fetchWithCORS(this.connectionData.url);
                    const content = await response.text();
                    this.parseM3U(content);
                    this.connectionData.content = content;
                }
                if (this.connectionData.epgUrl) {
                    await this.loadEPGFromURL(this.connectionData.epgUrl);
                }
                this.displayContent();
            }
            
            // Refresh current section
            await this.showSection(this.currentSection);
            
            Swal.fire({
                icon: 'success',
                title: 'Conteúdo Atualizado!',
                text: 'O conteúdo foi atualizado com sucesso.',
                timer: 2000,
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700'
            });
            
        } catch (error) {
            console.error('Error refreshing content:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro na Atualização',
                text: 'Erro ao atualizar o conteúdo. Verifique sua conexão.',
                background: '#1e3c72',
                color: '#ffffff',
                confirmButtonColor: '#ffd700'
            });
        } finally {
            this.showContentLoading(false);
        }
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

    showLoading(show, title = 'Carregando...', message = 'Conectando ao servidor...') {
        const overlay = document.getElementById('loading-overlay');
        const titleEl = document.getElementById('loading-title');
        const messageEl = document.getElementById('loading-message');
        
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        
        if (show) {
            overlay.classList.remove('d-none');
            overlay.classList.add('d-flex');
        } else {
            overlay.classList.remove('d-flex');
            overlay.classList.add('d-none');
        }
    }

    showContentLoading(show, title = 'Carregando conteúdo...', message = 'Aguarde...') {
        const overlay = document.getElementById('content-loading-overlay');
        const titleEl = document.getElementById('content-loading-title');
        const messageEl = document.getElementById('content-loading-message');
        
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        
        if (show) {
            overlay.classList.remove('d-none');
            overlay.classList.add('d-flex');
            // Add pulse animation to spinner for better visual feedback
            const spinner = overlay.querySelector('.spinner-border');
            if (spinner) {
                spinner.classList.add('loading-pulse');
            }
        } else {
            overlay.classList.remove('d-flex');
            overlay.classList.add('d-none');
            // Remove pulse animation
            const spinner = overlay.querySelector('.spinner-border');
            if (spinner) {
                spinner.classList.remove('loading-pulse');
            }
        }
    }

    // Enhanced loading for category clicks
    showCategoryLoading(categoryName, type) {
        const typeNames = {
            'channel': 'Canais',
            'movie': 'Filmes', 
            'series': 'Séries'
        };
        
        const icons = {
            'channel': '📺',
            'movie': '🎬',
            'series': '📺'
        };
        
        this.showContentLoading(
            true,
            `${icons[type]} Carregando ${typeNames[type]}...`,
            `Categoria: ${categoryName}`
        );
    }

    // Enhanced loading for individual content clicks
    showItemLoading(itemName, type) {
        const typeNames = {
            'movie': 'Filme',
            'series': 'Série', 
            'channel': 'Canal'
        };
        
        const icons = {
            'movie': '🎬',
            'series': '📺',
            'channel': '📡'
        };
        
        this.showContentLoading(
            true,
            `${icons[type]} Carregando ${typeNames[type]}...`,
            itemName
        );
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
        // Check if connection already exists
        const existingIndex = this.recentConnections.findIndex(conn => 
            conn.type === connectionType && this.isSameConnection(conn.data, connectionData)
        );

        if (existingIndex !== -1) {
            // Connection already exists - update lastUsed time and move to top
            const existingConnection = this.recentConnections[existingIndex];
            existingConnection.lastUsed = new Date().toISOString();
            
            // Remove from current position
            this.recentConnections.splice(existingIndex, 1);
            
            // Add to beginning of array
            this.recentConnections.unshift(existingConnection);
            
            console.log('Updated existing connection in recent list:', existingConnection.name);
            
            // Show subtle notification that connection was updated
            this.showConnectionUpdateNotification(existingConnection.name);
        } else {
            // New connection - create and add
            const recentConnection = {
                id: Date.now(),
                type: connectionType,
                data: connectionData,
                name: this.generateConnectionName(connectionData, connectionType),
                lastUsed: new Date().toISOString()
            };

            // Add to beginning of array
            this.recentConnections.unshift(recentConnection);
            
            console.log('Added new connection to recent list');
        }

        // Keep only last 5 connections
        this.recentConnections = this.recentConnections.slice(0, 5);

        localStorage.setItem('iptv-recent-connections', JSON.stringify(this.recentConnections));
        this.displayRecentConnections();
    }

    showConnectionUpdateNotification(connectionName) {
        // Create a subtle toast notification
        const notification = document.createElement('div');
        notification.className = 'position-fixed top-0 end-0 p-3';
        notification.style.cssText = 'z-index: 9999; animation: slideInRight 0.3s ease-out;';
        notification.innerHTML = `
            <div class="alert alert-info alert-dismissible fade show" role="alert" style="background: linear-gradient(135deg, #1e3c72, #2a5298); border: none; color: white;">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Conexão Atualizada:</strong> ${connectionName}
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification && notification.parentNode) {
                notification.remove();
            }
        }, 3000);
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
        // For Xtream connections, compare URL and username
        if (data1.username && data2.username) {
            return data1.url === data2.url && data1.username === data2.username;
        }
        
        // For M3U connections, compare URL/content
        if (data1.url && data2.url) {
            return data1.url === data2.url;
        }
        
        if (data1.content && data2.content) {
            return data1.content === data2.content;
        }
        
        // Additional check for listId to prevent duplicates from the same Vector Player list
        if (data1.listId && data2.listId) {
            return data1.listId === data2.listId;
        }
        
        return false;
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
                // Check if favorite already exists
                const existingIndex = this.favorites.findIndex(fav => 
                    fav.type === this.connectionType && this.isSameConnection(fav.data, this.connectionData)
                );

                if (existingIndex !== -1) {
                    // Update existing favorite
                    this.favorites[existingIndex].name = result.value;
                    this.favorites[existingIndex].createdAt = new Date().toISOString();
                    
                    Swal.fire({
                        icon: 'info',
                        title: 'Favorito Atualizado!',
                        text: `O favorito "${result.value}" foi atualizado.`,
                        timer: 2000,
                        background: '#1e3c72',
                        color: '#ffffff',
                        confirmButtonColor: '#ffd700'
                    });
                } else {
                    // Create new favorite
                    const favorite = {
                        id: Date.now(),
                        name: result.value,
                        type: this.connectionType,
                        data: this.connectionData,
                        createdAt: new Date().toISOString()
                    };

                    this.favorites.push(favorite);
                    
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

                this.saveFavorites();
                this.displayFavorites();
            }
        });
    }

    showPlayButton() {
        const video = document.getElementById('video-player');
        const playButton = document.createElement('div');
        playButton.className = 'position-absolute top-50 start-50 translate-middle';
        playButton.style.cssText = 'z-index: 1000; cursor: pointer;';
        playButton.innerHTML = `
            <div class="bg-dark bg-opacity-75 rounded-circle p-3" onclick="this.parentElement.style.display='none'; document.getElementById('video-player').play();">
                <i class="fas fa-play text-white" style="font-size: 3rem; margin-left: 5px;"></i>
            </div>
        `;
        
        video.parentElement.style.position = 'relative';
        video.parentElement.appendChild(playButton);
        
        // Remove play button when video starts
        video.addEventListener('play', () => {
            if (playButton.parentElement) {
                playButton.remove();
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

    goBackToSeriesList() {
        // Clean up backdrop image
        const seriesScreen = document.getElementById('series-details-screen');
        if (seriesScreen) {
            seriesScreen.style.backgroundImage = '';
            seriesScreen.style.backgroundSize = '';
            seriesScreen.style.backgroundPosition = '';
            seriesScreen.style.backgroundRepeat = '';
            seriesScreen.style.backgroundAttachment = '';
        }
        
        // Return to main screen and show series section
        this.showScreen('main-screen');
        
        // Show series section
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
            sec.style.display = 'none';
        });
        const seriesSection = document.getElementById('series-section');
        seriesSection.classList.add('active');
        seriesSection.style.display = 'block';
        
        // Update navigation active state
        document.querySelectorAll('.nav-link').forEach(item => {
            item.classList.remove('active');
        });
        // Find and activate series nav button
        const seriesNavBtn = document.querySelector('button[onclick="showSection(\'series\')"]');
        if (seriesNavBtn) {
            seriesNavBtn.classList.add('active');
        }
        
        this.currentSection = 'series';
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
    player.showContentLoading(true, 'Voltando às Categorias...', 'Carregando categorias de canais...');
    setTimeout(() => {
        player.showChannelCategories();
        player.showContentLoading(false);
    }, 300);
}

function showMovieCategories() {
    player.showContentLoading(true, 'Voltando às Categorias...', 'Carregando categorias de filmes...');
    setTimeout(() => {
        player.showMovieCategories();
        player.showContentLoading(false);
    }, 300);
}

function showSeriesCategories() {
    player.showContentLoading(true, 'Voltando às Categorias...', 'Carregando categorias de séries...');
    setTimeout(() => {
        player.showSeriesCategories();
        player.showContentLoading(false);
    }, 300);
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

function goBackToSeriesList() {
    player.goBackToSeriesList();
}

// Initialize the application
const player = new IPTVPlayer();

// Add error handling for debugging
window.addEventListener('error', (e) => {
    console.error('JavaScript Error:', e.error);
    console.error('Stack:', e.error?.stack);
});

// Force remove overlays when any modal is shown
document.addEventListener('DOMContentLoaded', function() {
    // Listen for modal events
    document.addEventListener('show.bs.modal', (event) => {
        // Force remove all loading overlays
        const overlays = document.querySelectorAll('.loading-overlay, #loading-overlay, #content-loading-overlay');
        overlays.forEach(overlay => {
            overlay.classList.remove('active', 'd-flex');
            overlay.classList.add('d-none');
            overlay.style.display = 'none';
            overlay.style.visibility = 'hidden';
        });
        
        // Remove any stray overlays with high z-index
        document.querySelectorAll('div[style*="z-index"]').forEach(el => {
            const zIndex = parseInt(el.style.zIndex || '0');
            if (zIndex > 1000 && zIndex < 9999 && !el.classList.contains('modal') && el.id !== 'player-modal') {
                el.style.display = 'none';
            }
        });
    });
});