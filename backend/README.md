# Service implementation

`worker.ts` serves the SPA and same-origin guest API. D1 owns sessions, projects,
revisions, events, memories, proposals and results. HttpOnly cookies are hashed
before database storage. Every project route checks guest ownership. Writes use
revision checks; repeated event IDs are acknowledged without duplicate rows.

`shared/circuit.ts` supplies typed circuit documents, connectivity, validation,
SPICE generation, and candidate edit operations. Workers AI ranks the valid
candidates from current state, recent actions, and applicable project preferences.
A labeled deterministic fallback retains usable editing during inference failure.

`simulator/server.py` accepts only generated netlists, builds trusted analysis
commands, and runs ngspice in a disposable directory with process limits. The
container runs as a non-root user without outbound network access. Different
visitors use different container identities; stored records are outside containers.
AC gain is measured as output/input, including when excitation is not 1 V.

Supported verification is connectivity checking and a few concept-layout geometry
guides. It is not foundry DRC/LVS. See [operations](../docs/OPERATIONS.md).
