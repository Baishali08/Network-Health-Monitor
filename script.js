/* ============================================================
   Stellar Network Health Monitor — script.js
   Uses @stellar/stellar-sdk (loaded via CDN as StellarSdk)
   ============================================================ */

(() => {
    'use strict';

    // ───────── Configuration ─────────
    const NETWORKS = {
        mainnet: 'https://horizon.stellar.org',
        testnet: 'https://horizon-testnet.stellar.org',
    };

    let currentNetwork = 'mainnet';
    let server = new StellarSdk.Horizon.Server(NETWORKS[currentNetwork]);
    let streamClose = null;            // function to close the ledger stream
    let isStreaming = true;
    let pollTimer = null;

    // Data stores
    const ledgerHistory = [];          // last N ledger records
    const throughputData = [];         // { seq, ops } for bar chart
    const MAX_HISTORY = 12;
    const MAX_CHART_POINTS = 25;

    // ───────── DOM References ─────────
    const $ = (id) => document.getElementById(id);

    const DOM = {
        // KPI
        latestLedger:  $('val-latest-ledger'),
        closeTime:     $('val-close-time'),
        txCount:       $('val-tx-count'),
        opCount:       $('val-op-count'),
        baseFee:       $('val-base-fee'),
        // Status
        statusBadge:   $('status-badge'),
        ringFill:      $('ring-fill'),
        ringValue:     $('ring-value'),
        protocol:      $('val-protocol'),
        baseReserve:   $('val-base-reserve'),
        maxTxSet:      $('val-max-tx-set'),
        ledgerLag:     $('val-ledger-lag'),
        // Fee stats
        feeMin:        $('val-fee-min'),
        feeMode:       $('val-fee-mode'),
        feeP50:        $('val-fee-p50'),
        feeP95:        $('val-fee-p95'),
        feeP99:        $('val-fee-p99'),
        feeCapacity:   $('val-fee-capacity'),
        // Table
        ledgerBody:    $('ledger-body'),
        // Stream
        streamFeed:    $('stream-feed'),
        streamToggle:  $('btn-stream-toggle'),
        liveIndicator: $('live-indicator'),
        // Canvas
        canvas:        $('throughput-canvas'),
        // Network buttons
        btnMainnet:    $('btn-mainnet'),
        btnTestnet:    $('btn-testnet'),
    };

    // ───────── Background Particles ─────────
    function createParticles() {
        const container = $('bg-particles');
        const count = 30;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const size = Math.random() * 4 + 1;
            const hue = Math.random() > 0.5 ? 240 : 185;   // indigo / cyan
            p.style.width = size + 'px';
            p.style.height = size + 'px';
            p.style.background = `hsla(${hue}, 80%, 65%, ${Math.random() * 0.3 + 0.1})`;
            p.style.left = Math.random() * 100 + '%';
            p.style.animationDuration = (Math.random() * 20 + 15) + 's';
            p.style.animationDelay = (Math.random() * 20) + 's';
            container.appendChild(p);
        }
    }

    // ───────── KPI Flash Effect ─────────
    function flashValue(el, newText) {
        if (el.textContent !== newText) {
            el.textContent = newText;
            el.classList.add('updated');
            setTimeout(() => el.classList.remove('updated'), 800);
        }
    }

    // ───────── Format Helpers ─────────
    function fmtNumber(n) {
        return Number(n).toLocaleString();
    }

    function fmtTime(isoStr) {
        return new Date(isoStr).toLocaleTimeString();
    }

    function stroopsToXLM(s) {
        return (Number(s) / 1e7).toFixed(7);
    }

    // ───────── Fetch Latest Ledger ─────────
    async function fetchLatestLedger() {
        try {
            const res = await server.ledgers().order('desc').limit(1).call();
            const ledger = res.records[0];
            processLedger(ledger, false);
        } catch (err) {
            console.error('Ledger fetch error:', err);
            setNetworkStatus('error', 'Error fetching ledger');
        }
    }

    // ───────── Process Ledger Record ─────────
    function processLedger(ledger, fromStream) {
        // Avoid duplicates
        if (ledgerHistory.length > 0 && ledgerHistory[0].sequence === ledger.sequence) return;

        // Push to history
        ledgerHistory.unshift(ledger);
        if (ledgerHistory.length > MAX_HISTORY) ledgerHistory.pop();

        // Throughput data
        throughputData.push({ seq: ledger.sequence, ops: ledger.operation_count });
        if (throughputData.length > MAX_CHART_POINTS) throughputData.shift();

        // Update KPI
        flashValue(DOM.latestLedger, fmtNumber(ledger.sequence));
        flashValue(DOM.closeTime, fmtTime(ledger.closed_at));
        flashValue(DOM.txCount, fmtNumber(ledger.successful_transaction_count));
        flashValue(DOM.opCount, fmtNumber(ledger.operation_count));
        flashValue(DOM.baseFee, fmtNumber(ledger.base_fee_in_stroops) + ' stroops');

        // Status details
        flashValue(DOM.protocol, 'v' + ledger.protocol_version);
        flashValue(DOM.baseReserve, stroopsToXLM(ledger.base_reserve_in_stroops) + ' XLM');
        flashValue(DOM.maxTxSet, fmtNumber(ledger.max_tx_set_size));

        // Ledger lag
        const lag = Date.now() - new Date(ledger.closed_at).getTime();
        const lagSec = (lag / 1000).toFixed(1);
        flashValue(DOM.ledgerLag, lagSec + 's');

        // Health
        const healthPct = lag < 8000 ? 100 : lag < 15000 ? 70 : lag < 30000 ? 40 : 10;
        setHealthRing(healthPct);

        if (healthPct >= 90) {
            setNetworkStatus('healthy', 'Healthy');
        } else if (healthPct >= 50) {
            setNetworkStatus('degraded', 'Degraded');
        } else {
            setNetworkStatus('down', 'Down');
        }

        // Table
        renderLedgerTable();

        // Chart
        drawChart();

        // Stream event
        if (fromStream) {
            addStreamEvent(ledger);
        }
    }

    // ───────── Network Status ─────────
    function setNetworkStatus(level, text) {
        DOM.statusBadge.className = 'status-badge ' + level;
        DOM.statusBadge.textContent = text;

        const dot = DOM.liveIndicator.querySelector('.pulse-dot');
        dot.className = 'pulse-dot' + (level === 'down' || level === 'error' ? ' error' : '');
    }

    // ───────── Health Ring ─────────
    function setHealthRing(pct) {
        const circumference = 2 * Math.PI * 52; // r=52
        const offset = circumference - (pct / 100) * circumference;
        DOM.ringFill.style.strokeDashoffset = offset;
        DOM.ringValue.textContent = pct + '%';
    }

    // ───────── Fee Statistics ─────────
    async function fetchFeeStats() {
        try {
            const url = NETWORKS[currentNetwork] + '/fee_stats';
            const res = await fetch(url);
            const data = await res.json();

            const charged = data.fee_charged || {};
            flashValue(DOM.feeMin, fmtNumber(charged.min || data.min_accepted_fee || '—'));
            flashValue(DOM.feeMode, fmtNumber(charged.mode || '—'));
            flashValue(DOM.feeP50, fmtNumber(charged.p50 || '—'));
            flashValue(DOM.feeP95, fmtNumber(charged.p95 || '—'));
            flashValue(DOM.feeP99, fmtNumber(charged.p99 || '—'));

            const capacity = data.ledger_capacity_usage
                ? (parseFloat(data.ledger_capacity_usage) * 100).toFixed(2)
                : '—';
            flashValue(DOM.feeCapacity, capacity);
        } catch (err) {
            console.error('Fee stats error:', err);
        }
    }

    // ───────── Ledger Table ─────────
    function renderLedgerTable() {
        DOM.ledgerBody.innerHTML = '';
        ledgerHistory.forEach((l) => {
            const tr = document.createElement('tr');
            const lag = Date.now() - new Date(l.closed_at).getTime();
            let statusHTML;
            if (lag < 10000) {
                statusHTML = '<span class="status-ok">● OK</span>';
            } else if (lag < 30000) {
                statusHTML = '<span class="status-warn">● Lag</span>';
            } else {
                statusHTML = '<span class="status-error">● Stale</span>';
            }
            tr.innerHTML = `
                <td>${fmtNumber(l.sequence)}</td>
                <td>${fmtTime(l.closed_at)}</td>
                <td>${fmtNumber(l.successful_transaction_count)}</td>
                <td>${fmtNumber(l.operation_count)}</td>
                <td>${statusHTML}</td>
            `;
            DOM.ledgerBody.appendChild(tr);
        });
    }

    // ───────── Throughput Bar Chart (Canvas) ─────────
    function drawChart() {
        const canvas = DOM.canvas;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const W = rect.width;
        const H = rect.height;
        const pad = { top: 20, right: 16, bottom: 36, left: 50 };
        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;

        ctx.clearRect(0, 0, W, H);

        if (throughputData.length < 2) return;

        const maxOps = Math.max(...throughputData.map(d => d.ops), 1);
        const barGap = 3;
        const barW = Math.max(4, (chartW / throughputData.length) - barGap);

        // Grid lines
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(W - pad.right, y);
            ctx.stroke();

            // Y-axis labels
            ctx.fillStyle = '#64748b';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxOps - (maxOps / 4) * i), pad.left - 8, y + 4);
        }

        // Bars
        throughputData.forEach((d, i) => {
            const barH = (d.ops / maxOps) * chartH;
            const x = pad.left + i * (barW + barGap);
            const y = pad.top + chartH - barH;

            // Gradient bar
            const grad = ctx.createLinearGradient(x, y, x, y + barH);
            grad.addColorStop(0, 'rgba(99, 102, 241, 0.9)');
            grad.addColorStop(1, 'rgba(6, 182, 212, 0.5)');
            ctx.fillStyle = grad;

            // Rounded top
            const r = Math.min(3, barW / 2);
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + barW - r, y);
            ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
            ctx.lineTo(x + barW, y + barH);
            ctx.lineTo(x, y + barH);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill();

            // X-axis labels (every few bars)
            if (i % Math.max(1, Math.floor(throughputData.length / 6)) === 0 || i === throughputData.length - 1) {
                ctx.fillStyle = '#64748b';
                ctx.font = '9px JetBrains Mono, monospace';
                ctx.textAlign = 'center';
                ctx.fillText(d.seq, x + barW / 2, H - pad.bottom + 16);
            }
        });

        // Axis labels
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Ledger Sequence', W / 2, H - 4);

        ctx.save();
        ctx.translate(12, pad.top + chartH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Operations', 0, 0);
        ctx.restore();
    }

    // ───────── Live Stream ─────────
    function startStream() {
        if (streamClose) {
            streamClose();
            streamClose = null;
        }

        DOM.streamFeed.innerHTML = '<div class="stream-placeholder">Connecting to Stellar Horizon…</div>';

        try {
            streamClose = server.ledgers()
                .cursor('now')
                .stream({
                    onmessage: (ledger) => {
                        processLedger(ledger, true);
                        fetchFeeStats();
                    },
                    onerror: (err) => {
                        console.warn('Stream error:', err);
                    }
                });
        } catch (err) {
            console.error('Failed to start stream:', err);
        }
    }

    function addStreamEvent(ledger) {
        if (!isStreaming) return;

        // Remove placeholder
        const placeholder = DOM.streamFeed.querySelector('.stream-placeholder');
        if (placeholder) placeholder.remove();

        const div = document.createElement('div');
        div.className = 'stream-event';
        div.innerHTML = `
            <span class="event-time">${fmtTime(ledger.closed_at)}</span>
            <span class="event-msg">
                Ledger <strong>#${fmtNumber(ledger.sequence)}</strong> closed — 
                ${ledger.successful_transaction_count} txns, 
                ${ledger.operation_count} ops, 
                ${ledger.failed_transaction_count || 0} failed
            </span>
        `;

        DOM.streamFeed.prepend(div);

        // Keep max 30 events
        while (DOM.streamFeed.children.length > 30) {
            DOM.streamFeed.lastChild.remove();
        }
    }

    // ───────── Stream Toggle ─────────
    DOM.streamToggle.addEventListener('click', () => {
        isStreaming = !isStreaming;
        DOM.streamToggle.classList.toggle('paused', !isStreaming);
        DOM.streamToggle.innerHTML = isStreaming
            ? '<span class="pulse-dot small"></span> Streaming'
            : '<span class="pulse-dot small"></span> Paused';
    });

    // ───────── Network Switch ─────────
    function switchNetwork(net) {
        if (net === currentNetwork) return;
        currentNetwork = net;
        server = new StellarSdk.Horizon.Server(NETWORKS[currentNetwork]);

        // Update UI
        DOM.btnMainnet.classList.toggle('active', net === 'mainnet');
        DOM.btnTestnet.classList.toggle('active', net === 'testnet');

        // Clear data
        ledgerHistory.length = 0;
        throughputData.length = 0;
        DOM.ledgerBody.innerHTML = '';
        DOM.streamFeed.innerHTML = '<div class="stream-placeholder">Connecting to Stellar Horizon…</div>';

        // Restart everything
        startStream();
        fetchLatestLedger();
        fetchFeeStats();
    }

    DOM.btnMainnet.addEventListener('click', () => switchNetwork('mainnet'));
    DOM.btnTestnet.addEventListener('click', () => switchNetwork('testnet'));

    // ───────── Polling fallback (for older data + fee stats) ─────────
    function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(() => {
            fetchLatestLedger();
            fetchFeeStats();
        }, 5000);
    }

    // ───────── Window Resize Handler ─────────
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(drawChart, 200);
    });

    // ───────── Boot ─────────
    function init() {
        createParticles();
        fetchLatestLedger();
        fetchFeeStats();
        startStream();
        startPolling();
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();