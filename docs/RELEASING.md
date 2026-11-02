# Releasing MnemoCode

This is the maintainer's procedure for a TypeScript maintenance release. A signed Git tag starts the build and creates a draft. The maintainer checks and OpenPGP-signs that draft on their own computer, then publishes it. The OpenPGP private key never enters GitHub Actions.

For checking a downloaded executable, follow [Download verification](CLI.md#download-verification).

## Release notes

Replace `(unreleased)` in the version's `CHANGELOG.md` heading with the release date. Write `docs/releases/v<version>.md` from that section; the workflow uses it as the release text and refuses a tag without it. Keep its links pinned to the release tag.

Update the version and maintenance-status notice at the top of `README.md`.

## Version

Set the same version in `package.json` and `src/version.ts`. `pnpm check` requires them to agree; the workflow requires the tag to be `v` followed by that version.

The examples below use `0.1.1`. Substitute the version you are actually releasing, and check that its tag does not already exist. Never move a published tag to release another build.

## Checks before the tag

Run the release checks one at a time:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm verify
corepack pnpm audit --audit-level high
npm pack --dry-run --json --ignore-scripts
```

The tag workflow runs the long canonical SSKR rebuild and comparison, `pnpm verify:sskr`; it need not be repeated locally.

Check that every new commit has a `gpgsig` header with `git cat-file -p <commit>`. Check both dates with `git log --format='%ad %cd' --date=iso`: they must use `+0000`. Run every date-writing Git command with `TZ=UTC`, including the tag below.

Push the release commit to `main` and wait for its CI to pass before tagging.

## Signed tag

Create an annotated tag using Git's configured SSH signing key, inspect it and push it:

```sh
TZ=UTC git tag -s v0.1.1 -m "MnemoCode 0.1.1"
git cat-file -p v0.1.1
git push origin v0.1.1
```

The tag must have an SSH signature and a UTC tagger date. Git-history signatures are separate from the OpenPGP signature of the release files.

## The tag's workflow

`.github/workflows/executable.yml` runs these jobs:

- `verify`: complete CI on the tagged commit.
- `sskr`: rebuild the share engine in its pinned container and compare it byte for byte with the committed engine.
- `build`: build Linux, Windows and macOS executables, run them from empty folders, and exercise their menus in real terminals.
- `release`: after all checks pass, write `SHA256SUMS`, create GitHub build attestations for its files, and create a draft with the three executables, their license notices and release notes.

The release job refuses a tag that already has a release or draft. To rerun a failed draft-creation attempt, delete its draft first; do not leave two drafts with different builds of one tag.

## Sign the draft

The signing computer needs GnuPG with the release key, `sha256sum`, and the [GitHub CLI](https://cli.github.com/) with `gh attestation`. Authenticate with permission to edit releases of `hobby-eng/mnemocode_typescript`.

Release key fingerprint:

```text
28FC51B1DB80DF2101128CB30EDD4814591DD095
```

From the checkout:

```sh
node scripts/sign-release.mjs v0.1.1 --dry-run
node scripts/sign-release.mjs v0.1.1
```

`--dry-run` prints the commands without executing them. A real run:

1. Checks the tools and secret key, then requires exactly one draft for the tag. It allows at most nine assets: six build files, `SHA256SUMS`, and a signature and public key from an unfinished run. No asset may exceed 512 MiB.
2. Downloads the draft to a new ignored folder, `release-signing-v0.1.1/`.
3. Requires `SHA256SUMS` to fit within 1 MiB and list at most six unique files. It checks the downloaded files, runs `sha256sum --check --strict SHA256SUMS`, and verifies each file's GitHub attestation.
4. Creates `SHA256SUMS.asc` with `gpg --local-user 28FC51B1DB80DF2101128CB30EDD4814591DD095 --armor --detach-sign`. GnuPG asks for the passphrase; the script never reads or copies the private key.
5. Verifies that signature and the signing key's fingerprint.
6. Exports `RELEASE-SIGNING-KEY.asc`.
7. Uploads the signature and public key, replacing copies from an unfinished run.

The script stops on a failure, on output above its 1 MiB limit, or on Ctrl+C. It uploads nothing until all checks pass. Before retrying, move aside the previous download folder.

The key is valid until 2028-10-04. Extend it before then and publish the extended public key on GitHub.

## Publish

Review the draft's notes, six build files, `SHA256SUMS`, `SHA256SUMS.asc` and `RELEASE-SIGNING-KEY.asc`. Publish it on GitHub or run:

```sh
gh release edit v0.1.1 --repo hobby-eng/mnemocode_typescript --draft=false
```

To sign and publish in one run, use `node scripts/sign-release.mjs v0.1.1 --publish`.

## Verify a download

The user-facing [verification instructions](CLI.md#download-verification) cover the key fingerprint, OpenPGP signature, checksums and GitHub attestations. A key supplied with a download is not an independent trust source: compare its fingerprint with one you already trust, such as the maintainer's key at https://github.com/hobby-eng.gpg.
