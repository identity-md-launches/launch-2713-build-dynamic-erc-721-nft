# Worker implementation review

This is the implementing worker's review, not an independent audit or network certification. The job uses the `none` profile and this is not a Foundry project. Solidity compilation and real contract execution are covered by the solc/Anvil test suite; no Foundry or Slither success is claimed.

## Scope

`contracts/SqueekCompanion.sol`, its OpenZeppelin ERC-721/Ownable2Step dependencies, generated ABI/bytecode handoff, telemetry parsing, deployment configuration and wallet transaction paths.

## Findings and disposition

| Finding | Disposition |
| --- | --- |
| HTTPS measurements cannot be fetched directly by an EVM contract. An unrestricted setter would let anyone invent RPM. | Reporter-restricted `publishStatus`; the explicit constructor owner is the initial reporter. Owner-only rotation emits an event. API authenticity remains a documented trust assumption; revision hash is not called proof. |
| A safe-mint receiver can call back before mint finishes. | Mint allowance and supply are updated before `_safeMint`; callback reentry from the same wallet reverts. A rejecting callback rolls back allowance and supply. Both receiver paths are executed in tests. |
| A transfer could accidentally renew a wallet's allowance if eligibility used balance. | Eligibility uses the permanent `hasMinted` mapping. Tests transfer away then retry, and test a recipient minting after receiving a transferred token. |
| Expired telemetry must not report idle or keep fast artwork forever. | `currentTraits.fresh` applies a 120-second TTL. Metadata mood and wheel state become unknown after expiry. Last numeric RPM is retained only with its measurement timestamp and unknown state. Tests execute both uninitialized and expired states. |
| SqueekCore is an external, upgradeable dependency. | Published V3 tuple is pinned. Calls have a 50,000-gas budget, try/catch and consistency checks on progress and cumulative units. Metadata degrades with `coreAvailable=false`; mint and transfer do not consult Core. Tests exercise unavailable and inconsistent state. |
| A configured address could point at another ERC-721 or an incorrect deployment. | Runtime bytecode hash must match the locally compiled artifact before public mint reads are enabled. The unlaunched handoff uses null fields, never a stand-in address. |
| A mint control could briefly appear ready immediately after a network switch while the signer client was loading. | Fixed with a disabled “Preparing your wallet…” state. The same guard is applied to browser deployment tools. Browser validation covers the network-add/switch path before real local-EVM minting. |
| Gallery retry originally only refetched ownership rows, even when collection configuration or eligibility was the failed prerequisite. | Fixed by passing a retry callback that also refreshes those prerequisite queries. |

## Contract properties checked

- Constructor requires Sepolia chain ID and a nonzero, explicit owner through OpenZeppelin Ownable.
- Nonpayable free mint; one lifetime successful mint per calling wallet; no privileged mint, supply expansion function, administrative transfer, pause, proxy or upgrade.
- Standard ERC-721 interfaces and approvals; ERC-4906 metadata refresh signaling.
- Reporter-only publication, owner-only reporter change, nonzero reporter, monotonic measurement time, freshness and future-time checks, nonzero revision pointer.
- Token existence before metadata generation; embedded valid JSON and SVG at resting/active/energetic thresholds.
- Two-step ownership acceptance and refusal by unrelated callers.
- Two seeded action sequences, 160 actions total, preserve total supply, ownership balances and lifetime allowances.

Compiler settings: solc 0.8.26, optimizer 200 runs, via IR, Cancun, no bytecode hash and no CBOR metadata. Runtime is 10,390 bytes; initcode is 11,428 bytes, below EIP-170 and EIP-3860 limits. The initial owner is a constructor argument, not a factory-derived role. There are no constructor external calls or linked libraries.

## Remaining operational dependencies

No public deployment or autonomous reporter is running. A real wallet/deployer must supply a confirmed deployment receipt, update the public handoff and publish fresh API measurements. The page and contract disclose unavailable readings rather than fabricate activity. The reporter is trusted for RPM and idle/spinning state; the contract does not verify the device's P-256 signature. Wallets and marketplaces may cache metadata after expiry or Core progress changes. Public API and RPC availability are external dependencies. See README “After launch” and `VALIDATION.md`.
