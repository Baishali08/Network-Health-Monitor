# Network Health Monitor - Soroban Smart Contract

This directory contains a Stellar Soroban smart contract configured in Rust. It serves as a decentralized registry for logging the network health status directly on the Stellar blockchain.

## Features

- **Initial Context**: Built to capture high-level states (e.g., "Healthy", "Degraded") evaluated by the frontend logic.
- **On-chain Storage**: Uses Soroban storage to safely persist the current health rating under a specific data key.

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- `wasm32-unknown-unknown` target
- [Soroban CLI](https://soroban.stellar.org/docs/getting-started/setup)

Make sure your environment is configured for compiling WebAssembly:

```bash
rustup target add wasm32-unknown-unknown
```

## Building

To build the smart contract, simply run:

```bash
cargo build --target wasm32-unknown-unknown --release
```

The compiled WASM file will be located at `target/wasm32-unknown-unknown/release/network_health_contract.wasm`.

## Deploying

Use the Soroban CLI to deploy and invoke the compiled WASM to a Local or Testnet network.

```bash
# Example: Deploying to Testnet
soroban contract deploy --wasm target/wasm32-unknown-unknown/release/network_health_contract.wasm --source your-identity --network testnet
```
