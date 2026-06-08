# Slither setup (macOS)

`run-audits.ts` needs `slither` + `solc` on PATH. macOS system Python (Xcode framework) can't host slither cleanly — it write-protects the directory solc-select needs and the shell often inherits a stale `$VIRTUAL_ENV` that mis-points solc-select. Use Homebrew Python in a venv.

## One-time install

```bash
# 1. Homebrew Python (skip if you already have it)
brew install python@3.12

# 2. Venv (any path; ours lives at ~/.venv/tryanneal-fresh)
/opt/homebrew/bin/python3.12 -m venv ~/.venv/tryanneal-fresh

# 3. Install slither + TryAnneal detector plugin
~/.venv/tryanneal-fresh/bin/pip install slither-analyzer
~/.venv/tryanneal-fresh/bin/pip install -e packages/detectors

# 4. Install solc 0.8.24 (matches packages/contracts hardhat.config.ts)
~/.venv/tryanneal-fresh/bin/solc-select install 0.8.24
~/.venv/tryanneal-fresh/bin/solc-select use 0.8.24

# 5. Symlink slither + solc into ~/.local/bin (must be on PATH)
mkdir -p ~/.local/bin
ln -sf ~/.venv/tryanneal-fresh/bin/slither      ~/.local/bin/slither
ln -sf ~/.venv/tryanneal-fresh/bin/solc-select  ~/.local/bin/solc-select
ln -sf ~/.solc-select/artifacts/solc-0.8.24/solc-0.8.24 ~/.local/bin/solc
```

## Each shell session before running scripts

```bash
# Strip any stale VIRTUAL_ENV inherited from VS Code / Cursor
unset VIRTUAL_ENV
export PATH="$HOME/.local/bin:$PATH"

# Verify
slither --version       # 0.11.5
solc --version          # 0.8.24
slither --list-detectors | grep agent-reentrancy   # confirms TryAnneal plugin loaded
```

## Confirmed pipeline (dry-run on local hardhat)

With slither + solc + custom plugin in place, `run-audits.ts` produces:

| Contract | Score | Findings |
|---|---:|---|
| SimpleToken.sol | 100 | clean |
| SampleVault.sol | 80 | 1 HIGH (reentrancy) |
| UnsafeOracle.sol | 70 | 3 MEDIUM (oracle staleness) |
| ProxyAdmin.sol | 87 | 1 MEDIUM + 1 LOW (delegatecall, admin control) |
| BatchTransfer.sol | 100 | clean from Slither built-ins; fixture is small enough that `calldata-bloat` doesn't trip |

5 verdicts posted on-chain, ~31k gas each.
