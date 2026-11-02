# Security policy

This page explains what MnemoCode protects, what it cannot protect, and how to report a vulnerability. For backup and recovery steps, use the [README](README.md) or [command-line reference](docs/CLI.md).

## Reporting a vulnerability

Report a suspected vulnerability through this repository's [private vulnerability reporting form](https://github.com/hobby-eng/mnemocode_typescript/security/advisories/new). It reaches the owner and maintainers. Keep an unfixed security problem out of public issues, discussions, pull requests, screenshots and logs.

Use a published test phrase or invented data. Never include a real phrase, BIP39 passphrase, private key, WIF, Shamir share, date, encoded record, QR code, card or wallet export. Include:

- the affected release or full commit SHA;
- the operating system and Node.js version;
- exact steps using only test data;
- the expected result, actual result and security impact.

Ordinary bugs and feature requests belong in the [public issue forms](https://github.com/hobby-eng/mnemocode_typescript/issues/new/choose). If a report could reveal recovery material or help an attacker, send it privately.

The TypeScript version receives fixes for critical defects only. Installed copies do not update themselves. Check which version you run, replace affected installations, and retain what you need to read existing backups.

## Security model

MnemoCode is an offline command-line program and TypeScript library. Its own code has no online service, telemetry, analytics, update check or remote file access. Wallet comparisons are calculated locally, without contacting a wallet, node or block explorer.

Use a trusted computer disconnected from every network, preferably a freshly started read-only live system. Unplug the network cable and turn off wireless connections before entering secrets. Avoid cloud terminals and remote shells. Shut down the temporary system after saving the result. A firewall, virtual machine or container adds protection only to the extent that you trust and check its configuration.

### Command-line protections

The CLI and standalone executable use the Node.js permission model. They normally allow no network, worker threads or native addons. A command that saves nothing gives up file writes; one that renders no images gives up child processes. Each menu task runs in its own process.

A caller that already runs Node.js under the permission model can grant additional rights, such as `--allow-net`; MnemoCode does not revoke those grants. Node.js describes its permission model as a safety belt for trusted code, not a boundary against malicious code.

Operating-system protections supplement that model where available:

| Platform | Additional protections                                                                                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linux    | Core dumps disabled; same-user memory inspection restricted; seccomp refuses new sockets and child processes where unnecessary; Landlock refuses unnecessary file writes on kernels that can apply the restriction to every thread |
| macOS    | Core dumps disabled; debugger attachment refused; the sandbox restricts network access and child processes                                                                                                                         |
| Windows  | A job object restricts child processes; crash reports omit the heap; mitigation policies reject extension DLLs and DLLs from network shares                                                                                        |

MnemoCode checks a protection before reporting it. Unsupported protections remain unavailable; `self-test` names the limits. On Linux and macOS, failure to disable core dumps prevents secret input.

Re-encode may need to write files or start an image converter after the original phrase is confirmed. Until the new backup's options are known, its interactive process retains those rights. It then gives up unnecessary Node.js permissions; operating-system restrictions retain what they allowed at process start.

`recover-word` may also retain file writes so it can offer an encrypted candidate list after a search. This applies without `--candidates-file`, outside legacy-final-word recovery, when using `--ask-secrets` or when no wallet reference was supplied by an option.

Descriptors opened before restrictions, including the terminal, remain usable. Linux io_uring instances opened by Node.js also remain available to native code; MnemoCode gives up permission to call native addons before secret input. “Offline” describes the program's behaviour. Restrictions against a compromised process depend on the operating system and its version.

### Library and browser hosts

The library inherits its host's file, process and network permissions. It creates no iframe, Worker, Content Security Policy or sandbox of its own. A browser's `connect-src 'none'` policy can block ordinary network requests, but other code in the same application can still read values. Review the final application and its protections as well as MnemoCode.

## Secret lifecycle and local boundaries

### Input, screens and memory

Use [`--ask-secrets`](README.md#secret-input-styles) or the [menu](README.md#menu) for real recovery material. The private screen shows input and results for checking, then clears them when you leave it. The main screen keeps only a summary of saved paths and warnings. Anyone watching the private screen can read the secrets; a logging or compromised terminal can retain them.

MnemoCode does not collect, transmit or log your phrase. It wipes its owned byte buffers when their work ends, including failure and cancellation paths, as far as the runtime allows. JavaScript strings and copies made by dependencies or the runtime cannot be guaranteed erased. Screenshots, clipboard history, accessibility tools, extensions and malware remain outside its control.

### Swap, hibernation and synchronized folders

On Linux, MnemoCode warns if swap is unencrypted or cannot be assessed. It recognizes dm-crypt, including beneath LVM, and zram as safe swap configurations. Node.js memory cannot be locked out of swap, so secret bytes may reach disk. Use encrypted swap or none. Hibernation can also write memory to disk; MnemoCode cannot prevent it.

MnemoCode warns for usual Dropbox, OneDrive, Google Drive, iCloud Drive, Yandex Disk, Nextcloud, MEGA and pCloud folder names. This is not complete synchronization detection. Use a local destination whose permissions, backups and synchronization you control.

### Exported files

Records, QR codes, PDFs, images, shares, dates and printed cards can help recover a wallet. Treat each as secret recovery material even if it is insufficient on its own.

Where supported, exported files are readable only by your user account. Completed files are published without replacing existing names. On filesystems without hard links, such as FAT and exFAT, an empty file reserves the name while the completed file is moved in; a failed move removes that reservation.

Folder publication reserves a new directory, then moves completed children into it. This is not atomic: forced termination or power loss can leave an empty or partial destination. These precautions do not isolate exports from malicious processes running as the same user.

Ctrl+C removes temporary export folders. Other termination or power loss can leave a hidden folder beside the output:

- `.mnemocode-export-…`
- `.mnemocode-images-…`
- `.mnemocode-share-qr-…`
- `.card-collection-…`
- `.sskr-cards-…`

These folders may contain a complete private copy; remove any abandoned ones. You remain responsible for destination permissions, snapshots, backups, cloud copies and removable media.

### Image conversion

PNG and JPEG export passes PDFs to local Poppler `pdftocairo` through standard input and receives images through standard output. Images go directly into the staging folder beside the destination; MnemoCode writes neither input PDFs nor output images to the system temporary directory.

It runs the first `pdftocairo` found through an absolute directory in `PATH`, using its full path. It ignores the current directory and empty or relative `PATH` entries. Use a trusted Poppler installation.

### Share-engine integrity

In a checkout or installed package, MnemoCode compares the local SSKR library files with pinned SHA-256 hashes before processing secrets. This detects changed files; it does not establish that the library is free of defects.

In a standalone executable, both the library and its hashes are embedded, so the check establishes internal consistency. Verify the executable against the signed release `SHA256SUMS` before running it. Share randomness comes from Node.js `crypto.randomFillSync`.

## Cryptographic and recovery limits

- Another representation or QR code is not encryption.
- Date masking can be reversed by anyone who knows or guesses the dates. Memorable dates are easy to guess; they do not replace authenticated, memory-hard encryption or a strong BIP39 passphrase.
- A valid BIP39 checksum does not identify your wallet. Compare recovered material with a known wallet reference, using the original network, address type, account, branch, index and passphrase.
- An address match checks the selected wallet location. MnemoCode does not discover accounts, read balances or send transactions. Verify recovered addresses in maintained wallet software before using funds.
- Any N distinct shares of an N-of-M set restore the phrase. Store shares separately. A BIP39 passphrase is not included in them.

## Residual risks and assurance

A compromised operating system, Node.js runtime, dependency, image converter, terminal, build computer, package source, firmware or physical environment can defeat these protections. Pinned versions and hashes help reproduce builds; they do not establish trust by themselves. Where possible, verify a release's origin and checksums on another computer before entering secrets.

The project has automated tests and dated audit records. It has not had an independent security audit by cryptography specialists. The Rust SSKR library describes itself as under community review; the external audit of the C implementation does not cover it. The [architecture](docs/ARCHITECTURE.md) and [audit records](docs/audits/README.md) describe the evidence and its limits.
