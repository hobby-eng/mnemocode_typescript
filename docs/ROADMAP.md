# Roadmap

Version 0.1.1 is the last TypeScript release. This repository receives fixes for critical defects only. Development continues in the Rust successor linked from the [README](../README.md). The plans below concern that successor unless stated otherwise.

## Recovery in the Wallet Deriver

The Wallet Deriver in the [multi-chain wallet tools](https://github.com/hobby-eng/multi-chain-wallet-tools) compiles MnemoCode's host-neutral TypeScript sources, as described in its [source-import guide](https://github.com/hobby-eng/multi-chain-wallet-tools/blob/main/docs/MNEMOCODE_SOURCE.md). The library already supports:

- forgotten words;
- missing date digits;
- damaged Shamir shares, alone or in a set, with a work estimate before searching;
- candidate lists for the Discovery Scanner.

Hosts provide platform services such as PBKDF2, HMAC-SHA256, the share engine and rendering. The [library guide](LIBRARY.md) describes these interfaces; the [architecture](ARCHITECTURE.md#modules-for-other-hosts) records the dependency boundaries checked by the tests.

## MnemoCode in Rust

The Rust implementation is developed separately. Replacing TypeScript requires matching its functions, formats, parameters, public vectors and existing output files. The intended structure is one library used by the CLI and a WASM build for browser hosts.

The port includes G1-001: make Bytewords/UR share transport the responsibility of one Rust module, rather than first consolidating the TypeScript and Rust implementations here. Other goals are to preserve every supported coin's wallet checks, speed up recovery of several words, and handle larger candidate lists. These are development goals, not a statement that parity or performance acceptance is complete.

## Mobile applications

Android and, where feasible, iOS applications remain future work. They would use the same Rust library, with platform adapters for input, files, randomness, execution and memory protection.

Before claiming support, assess device memory and process limits, long-running searches, and cleanup when an application pauses, stops or is terminated. Define supported workloads and devices from those results. Mobile applications are not part of the TypeScript CLI release.
