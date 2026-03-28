-- Pokedex HTML Page - Graphical Pokedex viewer served at /pokedex
-- Self-contained HTML/CSS/JS page that fetches live data from /api/pokedex

local PokedexHtml = {}

function PokedexHtml.getPokedexPage(port, host)
    local html = [[
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pok&eacute;dex - Pokemon Memory Reader</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: #1a1a2e;
            color: #e0e0e0;
            min-height: 100vh;
        }

        .header {
            background: linear-gradient(135deg, #c62828 0%, #b71c1c 50%, #880e4f 100%);
            padding: 20px 30px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header h1 {
            font-size: 28px;
            font-weight: 700;
            color: #fff;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .header .subtitle {
            font-size: 14px;
            color: rgba(255,255,255,0.8);
            margin-top: 4px;
        }

        .stats-bar {
            display: flex;
            gap: 20px;
            padding: 16px 30px;
            background: #16213e;
            border-bottom: 1px solid #2a2a4a;
            flex-wrap: wrap;
            align-items: center;
        }

        .stat-card {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 16px;
            background: #1a1a3e;
            border-radius: 8px;
            border: 1px solid #2a2a5a;
        }

        .stat-card .stat-icon {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }

        .stat-card .stat-value {
            font-size: 22px;
            font-weight: 700;
        }

        .stat-card .stat-label {
            font-size: 12px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .progress-container {
            flex: 1;
            min-width: 200px;
            max-width: 400px;
        }

        .progress-bar {
            width: 100%;
            height: 24px;
            background: #2a2a4a;
            border-radius: 12px;
            overflow: hidden;
            position: relative;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #e53935 0%, #ff5722 50%, #ffb300 100%);
            border-radius: 12px;
            transition: width 0.8s ease;
            position: relative;
        }

        .progress-text {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 12px;
            font-weight: 700;
            color: #fff;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }

        .controls {
            display: flex;
            gap: 12px;
            padding: 14px 30px;
            background: #1a1a35;
            border-bottom: 1px solid #2a2a4a;
            flex-wrap: wrap;
            align-items: center;
        }

        .search-box {
            padding: 8px 14px;
            border: 1px solid #3a3a5a;
            border-radius: 6px;
            background: #16213e;
            color: #e0e0e0;
            font-size: 14px;
            width: 240px;
            outline: none;
            transition: border-color 0.2s;
        }

        .search-box:focus {
            border-color: #e53935;
        }

        .filter-btn {
            padding: 8px 16px;
            border: 1px solid #3a3a5a;
            border-radius: 6px;
            background: #16213e;
            color: #aaa;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        }

        .filter-btn:hover {
            background: #2a2a4a;
            color: #fff;
        }

        .filter-btn.active {
            background: #e53935;
            color: #fff;
            border-color: #e53935;
        }

        .refresh-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            background: #e53935;
            color: #fff;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s;
            margin-left: auto;
        }

        .refresh-btn:hover {
            background: #c62828;
        }

        .refresh-btn:disabled {
            background: #555;
            cursor: wait;
        }

        .auto-refresh {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: #888;
        }

        .auto-refresh input {
            accent-color: #e53935;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 8px;
            padding: 20px 30px;
        }

        .pokemon-card {
            background: #16213e;
            border: 1px solid #2a2a5a;
            border-radius: 8px;
            padding: 12px;
            transition: all 0.2s;
            cursor: default;
            position: relative;
            overflow: hidden;
        }

        .pokemon-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }

        .pokemon-card.caught {
            border-color: #43a047;
            background: linear-gradient(135deg, #1b3a1b 0%, #16213e 100%);
        }

        .pokemon-card.seen {
            border-color: #ffa726;
            background: linear-gradient(135deg, #3a2a10 0%, #16213e 100%);
        }

        .pokemon-card.uncaught {
            border-color: #2a2a5a;
            opacity: 0.5;
        }

        .pokemon-card .dex-number {
            font-size: 11px;
            color: #666;
            font-weight: 600;
        }

        .pokemon-card .pokemon-name {
            font-size: 15px;
            font-weight: 600;
            margin-top: 2px;
            color: #fff;
        }

        .pokemon-card.uncaught .pokemon-name {
            color: #666;
        }

        .pokemon-card .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 6px;
        }

        .pokemon-card.caught .status-badge {
            background: #2e7d32;
            color: #a5d6a7;
        }

        .pokemon-card.seen .status-badge {
            background: #e65100;
            color: #ffcc80;
        }

        .pokemon-card.uncaught .status-badge {
            background: #333;
            color: #666;
        }

        .pokemon-card .type-row {
            display: flex;
            gap: 4px;
            margin-top: 6px;
        }

        .type-badge {
            padding: 1px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            color: #fff;
        }

        .type-Normal    { background: #a8a878; }
        .type-Fire      { background: #f08030; }
        .type-Water     { background: #6890f0; }
        .type-Electric  { background: #f8d030; color: #333; }
        .type-Grass     { background: #78c850; }
        .type-Ice       { background: #98d8d8; color: #333; }
        .type-Fighting  { background: #c03028; }
        .type-Poison    { background: #a040a0; }
        .type-Ground    { background: #e0c068; color: #333; }
        .type-Flying    { background: #a890f0; }
        .type-Psychic   { background: #f85888; }
        .type-Bug       { background: #a8b820; }
        .type-Rock      { background: #b8a038; }
        .type-Ghost     { background: #705898; }
        .type-Dragon    { background: #7038f8; }
        .type-Dark      { background: #705848; }
        .type-Steel     { background: #b8b8d0; color: #333; }
        .type-Fairy     { background: #ee99ac; color: #333; }

        .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 80px;
            color: #888;
        }

        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #2a2a4a;
            border-top-color: #e53935;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 16px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .error-msg {
            text-align: center;
            padding: 60px;
            color: #e53935;
            font-size: 16px;
        }

        .error-msg .error-detail {
            color: #888;
            font-size: 13px;
            margin-top: 8px;
        }

        .pokeball-icon {
            display: inline-block;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid;
            position: relative;
        }

        .pokeball-icon.caught-icon {
            border-color: #43a047;
            background: radial-gradient(circle at center, #fff 3px, #43a047 3px, #43a047 4px, #a5d6a7 4px);
        }

        .pokeball-icon.seen-icon {
            border-color: #ffa726;
            background: radial-gradient(circle at center, #fff 3px, #ffa726 3px, #ffa726 4px, #ffe0b2 4px);
        }

        .pokeball-icon.uncaught-icon {
            border-color: #555;
            background: radial-gradient(circle at center, #fff 3px, #555 3px, #555 4px, #333 4px);
        }

        .no-results {
            grid-column: 1 / -1;
            text-align: center;
            padding: 40px;
            color: #666;
            font-size: 16px;
        }

        .pokemon-card .locations {
            margin-top: 6px;
            font-size: 10px;
            color: #888;
            line-height: 1.4;
            display: none;
            border-top: 1px solid #2a2a5a;
            padding-top: 6px;
        }

        .pokemon-card.expanded .locations {
            display: block;
        }

        .pokemon-card .loc-entry {
            display: flex;
            justify-content: space-between;
            gap: 4px;
        }

        .pokemon-card .loc-name {
            color: #aaa;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .pokemon-card .loc-detail {
            color: #666;
            white-space: nowrap;
            font-size: 9px;
        }

        .pokemon-card .loc-count {
            font-size: 10px;
            color: #555;
            margin-top: 4px;
            cursor: pointer;
        }

        .pokemon-card .loc-count:hover {
            color: #e53935;
        }

        .diag-panel {
            margin: 12px 30px;
            padding: 16px;
            background: #0d1b2a;
            border: 1px solid #e53935;
            border-radius: 8px;
            display: none;
        }

        .diag-panel h3 {
            color: #e53935;
            margin-bottom: 10px;
            font-size: 16px;
        }

        .diag-panel .diag-info {
            font-size: 13px;
            color: #aaa;
            margin-bottom: 8px;
        }

        .diag-btn {
            padding: 8px 16px;
            border: 1px solid #e53935;
            border-radius: 6px;
            background: transparent;
            color: #e53935;
            cursor: pointer;
            font-size: 13px;
            margin-right: 8px;
            transition: all 0.2s;
        }

        .diag-btn:hover {
            background: #e53935;
            color: #fff;
        }

        .diag-results {
            margin-top: 12px;
            padding: 12px;
            background: #111;
            border-radius: 6px;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
            color: #0f0;
            max-height: 300px;
            overflow-y: auto;
        }

        .candidate-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 6px 0;
            border-bottom: 1px solid #222;
        }

        .candidate-row button {
            padding: 4px 10px;
            border: 1px solid #43a047;
            border-radius: 4px;
            background: transparent;
            color: #43a047;
            cursor: pointer;
            font-size: 11px;
        }

        .candidate-row button:hover {
            background: #43a047;
            color: #fff;
        }

        .toggle-diag {
            padding: 6px 12px;
            border: 1px solid #555;
            border-radius: 6px;
            background: transparent;
            color: #888;
            cursor: pointer;
            font-size: 12px;
        }

        .toggle-diag:hover {
            color: #e53935;
            border-color: #e53935;
        }

        .offset-info {
            font-size: 12px;
            color: #666;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Pok&eacute;dex</h1>
        <div class="subtitle" id="game-name">Connecting to Pokemon Memory Reader...</div>
    </div>

    <div class="stats-bar" id="stats-bar" style="display:none;">
        <div class="stat-card">
            <div class="pokeball-icon caught-icon"></div>
            <div>
                <div class="stat-value" id="stat-caught" style="color:#66bb6a;">0</div>
                <div class="stat-label">Caught</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="pokeball-icon seen-icon"></div>
            <div>
                <div class="stat-value" id="stat-seen" style="color:#ffa726;">0</div>
                <div class="stat-label">Seen</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="pokeball-icon uncaught-icon"></div>
            <div>
                <div class="stat-value" id="stat-uncaught" style="color:#888;">0</div>
                <div class="stat-label">Uncaught</div>
            </div>
        </div>
        <div class="stat-card">
            <div>
                <div class="stat-value" id="stat-total" style="color:#e0e0e0;">0</div>
                <div class="stat-label">Total</div>
            </div>
        </div>
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress-fill" id="progress-fill" style="width:0%">
                    <span class="progress-text" id="progress-text">0%</span>
                </div>
            </div>
        </div>
    </div>

    <div class="controls" id="controls" style="display:none;">
        <input type="text" class="search-box" id="search" placeholder="Search name or location...">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="caught">Caught</button>
        <button class="filter-btn" data-filter="seen">Seen Only</button>
        <button class="filter-btn" data-filter="uncaught">Uncaught</button>
        <div class="auto-refresh">
            <input type="checkbox" id="auto-refresh" checked>
            <label for="auto-refresh">Auto-refresh (5s)</label>
        </div>
        <span class="offset-info" id="offset-info"></span>
        <button class="refresh-btn" id="refresh-btn">Refresh</button>
    </div>

    <div id="content">
        <div class="loading">
            <div class="spinner"></div>
            <div>Loading Pok&eacute;dex data...</div>
        </div>
    </div>

    <script>
        let pokedexData = null;
        let currentFilter = 'all';
        let searchTerm = '';
        let autoRefreshInterval = null;
        const API_URL = '/api/pokedex';
        const STATUS_URL = '/status';

        async function fetchPokedex() {
            const btn = document.getElementById('refresh-btn');
            if (btn) btn.disabled = true;

            try {
                const response = await fetch(API_URL);
                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.message || err.error || 'Failed to fetch');
                }
                pokedexData = await response.json();
                updateStats();
                updateOffsetInfo();
                renderGrid();
                document.getElementById('stats-bar').style.display = 'flex';
                document.getElementById('controls').style.display = 'flex';

                // Fetch game name
                try {
                    const statusResp = await fetch(STATUS_URL);
                    const status = await statusResp.json();
                    document.getElementById('game-name').textContent = status.game.name || 'Unknown Game';
                } catch(e) {}

            } catch (err) {
                document.getElementById('content').innerHTML =
                    '<div class="error-msg">' +
                    'Failed to load Pok&eacute;dex data' +
                    '<div class="error-detail">' + escapeHtml(err.message) + '</div>' +
                    '<div class="error-detail" style="margin-top:12px;">Make sure BizHawk is running with a Pokemon ROM loaded.</div>' +
                    '</div>';
            } finally {
                if (btn) btn.disabled = false;
            }
        }

        function updateStats() {
            if (!pokedexData) return;
            document.getElementById('stat-caught').textContent = pokedexData.caught;
            document.getElementById('stat-seen').textContent = pokedexData.seen;
            document.getElementById('stat-uncaught').textContent = pokedexData.uncaught;
            document.getElementById('stat-total').textContent = pokedexData.totalSpecies;

            const pct = pokedexData.completionPercent;
            const fill = document.getElementById('progress-fill');
            fill.style.width = pct + '%';
            document.getElementById('progress-text').textContent = pct + '%';
        }

        function renderGrid() {
            if (!pokedexData || !pokedexData.entries) return;

            let entries = pokedexData.entries;

            // Apply filter
            if (currentFilter === 'caught') {
                entries = entries.filter(e => e.caught);
            } else if (currentFilter === 'seen') {
                entries = entries.filter(e => e.seen && !e.caught);
            } else if (currentFilter === 'uncaught') {
                entries = entries.filter(e => !e.caught);
            }

            // Apply search
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                entries = entries.filter(e =>
                    e.name.toLowerCase().includes(term) ||
                    String(e.natDex || e.speciesId).includes(term) ||
                    (e.locations && e.locations.some(l => l.loc.toLowerCase().includes(term)))
                );
            }

            if (entries.length === 0) {
                document.getElementById('content').innerHTML =
                    '<div class="grid"><div class="no-results">No Pok&eacute;mon match your filter.</div></div>';
                return;
            }

            let html = '<div class="grid">';
            for (const entry of entries) {
                const statusClass = entry.caught ? 'caught' : (entry.seen ? 'seen' : 'uncaught');
                const statusLabel = entry.caught ? 'Caught' : (entry.seen ? 'Seen' : 'Uncaught');
                const displayName = entry.name;

                html += '<div class="pokemon-card ' + statusClass + '">';
                html += '<div class="dex-number">#' + String(entry.natDex || entry.speciesId).padStart(3, '0') + '</div>';
                html += '<div class="pokemon-name">' + escapeHtml(displayName) + '</div>';
                html += '<span class="status-badge">' + statusLabel + '</span>';

                if (entry.types && entry.types.length > 0) {
                    html += '<div class="type-row">';
                    for (const type of entry.types) {
                        html += '<span class="type-badge type-' + type + '">' + type + '</span>';
                    }
                    html += '</div>';
                }

                if (entry.locations && entry.locations.length > 0) {
                    html += '<div class="loc-count" onclick="this.parentElement.classList.toggle(\'expanded\')">';
                    html += entry.locations.length + ' location' + (entry.locations.length > 1 ? 's' : '') + ' ▸';
                    html += '</div>';
                    html += '<div class="locations">';
                    for (const loc of entry.locations) {
                        html += '<div class="loc-entry">';
                        html += '<span class="loc-name">' + escapeHtml(loc.loc) + '</span>';
                        html += '<span class="loc-detail">Lv' + loc.lv + ' ' + loc.r + '</span>';
                        html += '</div>';
                    }
                    html += '</div>';
                }

                html += '</div>';
            }
            html += '</div>';

            document.getElementById('content').innerHTML = html;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Event listeners
        document.addEventListener('DOMContentLoaded', function() {
            fetchPokedex();

            document.getElementById('search').addEventListener('input', function(e) {
                searchTerm = e.target.value;
                renderGrid();
            });

            document.querySelectorAll('.filter-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentFilter = btn.dataset.filter;
                    renderGrid();
                });
            });

            document.getElementById('refresh-btn').addEventListener('click', fetchPokedex);

            // Auto-refresh
            document.getElementById('auto-refresh').addEventListener('change', function(e) {
                if (e.target.checked) {
                    startAutoRefresh();
                } else {
                    stopAutoRefresh();
                }
            });

            startAutoRefresh();
        });

        function startAutoRefresh() {
            stopAutoRefresh();
            autoRefreshInterval = setInterval(fetchPokedex, 5000);
        }

        function stopAutoRefresh() {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }
        }

        function updateOffsetInfo() {
            const el = document.getElementById('offset-info');
            if (pokedexData && pokedexData.caughtAddr) {
                el.textContent = 'caught:' + pokedexData.caughtAddr + ' seen:' + pokedexData.seenAddr;
            }
        }

    </script>
</body>
</html>]]

    return html
end

return PokedexHtml
