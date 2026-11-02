# MnemoCode documentation

Start with the [README](../README.md) to choose a task. Its sections follow the program's menu. The guides below provide details for users, library hosts and maintainers.

## Using the program

| Guide                                            | What it covers                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| [Command-line reference](CLI.md)                 | Download verification, paired command examples, input/output rules and options |
| [A guide for heirs](HEIRS.md)                    | Restoring an inherited backup and recognizing common recovery problems         |
| [Shamir shares](SSKR.md)                         | Creating, storing, restoring and repairing shares; share transport details     |
| [Card designs](card-designs.md)                  | What appears on cards and collection sheets                                    |
| [Card identity defaults](card-identities.md)     | Invented names, contact details and studio text                                |
| [Recovery without MnemoCode](MANUAL_RECOVERY.md) | Printed dictionaries, manual date reversal and a standalone Python helper      |
| [Security policy](../SECURITY.md)                | Threats, protections, export precautions and private vulnerability reporting   |

## Library and formats

| Guide                                               | What it covers                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Using the TypeScript library](LIBRARY.md)          | Examples, platform interfaces, ownership, cancellation and host contracts    |
| [Source layout](ARCHITECTURE.md)                    | Module responsibilities, entry points, dependency boundaries and build tools |
| [Candidate lists](CANDIDATES.md)                    | MNCL bytes, candidate ordering, encryption parameters and limits             |
| [Seedshift construction](SEEDSHIFT_CONSTRUCTION.md) | The checksum-valid transformation and its reversibility proof                |

## Maintenance and history

| Guide                                                                                   | What it covers                                                       |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Roadmap](ROADMAP.md)                                                                   | TypeScript maintenance status and goals for the Rust successor       |
| [Releasing](RELEASING.md)                                                               | Maintainer checks, signed tags, draft signing and publication        |
| [Remediation register](REMEDIATION.md)                                                  | Known findings, verification states and dated historical checkpoints |
| [Audit index](audits/README.md)                                                         | Reports and their original scope, source identities and limits       |
| [Changelog](../CHANGELOG.md)                                                            | Version-by-version changes                                           |
| [0.1.0 release notes](releases/v0.1.0.md) and [0.1.1 release notes](releases/v0.1.1.md) | Published release descriptions                                       |
| [Third-party notices](../THIRD_PARTY_NOTICES.md)                                        | Dependencies, artwork and attribution                                |

The TypeScript version receives fixes for critical defects only. Historical release and audit records describe their own snapshots; they are not a claim about a later build.
