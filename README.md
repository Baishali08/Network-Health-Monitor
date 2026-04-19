# Stellar Network Health Monitor 🌌

A premium, real-time dashboard for monitoring the health and performance of the Stellar blockchain network. Built using the tracking capabilities of the [Stellar Horizon API](https://developers.stellar.org/api/horizon) and the `@stellar/stellar-sdk`.

## ✨ Features

- **Real-Time Ledger Streaming**: Leverages Server-Sent Events (SSE) to receive live ledger updates with zero polling delay.
- **Network Status & Health**: Dynamic health ring that calculates live network health based on ledger lag and consensus metrics.
- **Live Fee Statistics**: Up-to-date breakdown of network fees including min, mode, percentiles (p50, p95, p99), and total ledger capacity usage.
- **Transaction Throughput Chart**: High-performance HTML5 Canvas rendering of operations recorded per ledger over time.
- **Network Switching**: Instantly toggle between Stellar **Mainnet** and **Testnet** environments.
- **Ledger History Table**: Detailed tabular breakdown of the most recent network ledgers (sequence, timestamps, transactions, operations, and individual status).
- **Premium UI/UX**: State-of-the-art dark mode aesthetic featuring glassmorphism, animated data diffs, a fluid CSS particle background, and a responsive grid architecture.

## 🚀 Getting Started

This is a lightweight, frontend-only application with no build steps or heavy bundlers required.

### Prerequisites

None! All you need is a modern web browser.

### Installation

1. Clone this repository or download the source code:
   ```bash
   git clone https://github.com/your-username/network-health-monitor.git
   ```
2. Navigate into the directory:
   ```bash
   cd "Network Health Monitor"
   ```

### Running Locally

Because this uses modern browser APIs, you can simply open the `index.html` file in your browser to start the dashboard.

Alternatively, for the best development experience, you can serve it via a local HTTP server:

```bash
# Using Python 3
python -m http.server 8080

# Or using Node.js / npx
npx serve .
```

Then, visit `http://localhost:8080` in your web browser.

## 🛠 Built With

- **[Stellar JavaScript SDK](https://github.com/stellar/js-stellar-sdk)** (`v14.6.1`) - The official library for working with the Stellar network.
- **Vanilla JavaScript (ES6+)** - Lightweight, zero-dependency logic handling streaming, state, and data manipulation.
- **Custom CSS3** - Modern grid layouts, custom properties (tokens), and keyframe animations without the overhead of external CSS frameworks.
- **HTML5 Canvas** - Performant custom rendering for the throughput visualizer.

## 📂 Project Structure

- `index.html`: The document structure, integrating Google Fonts and external SDK resources.
- `styles.css`: The comprehensive design system, featuring CSS variables for straightforward theming and responsive media queries.
- `script.js`: The core application engine. Coordinates Horizon endpoint requests (e.g. `/fee_stats`) alongside realtime SSE streams (`server.ledgers().stream()`).

## 🤝 Contributing

Contributions, issues, and feature requests are always welcome! Feel free to check the issues page if you want to contribute.

## 📄 License

This project is open-source and available under the standard MIT License.
