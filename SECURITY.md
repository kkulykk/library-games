# Security Policy

## Supported versions

Library Games is a continuously deployed static site. Only the latest deploy
(the current `main`, served at https://kkulykk.github.io/library-games) is
supported. There are no released/back-supported versions.

## Reporting a vulnerability

Please report suspected vulnerabilities privately rather than opening a public
issue:

- Preferred: open a [GitHub private security advisory](https://github.com/kkulykk/library-games/security/advisories/new).
- Alternatively: email kkulykk@gmail.com.

Please include enough detail to reproduce (affected URL/RPC, steps, and impact).
We aim to acknowledge reports within a few days. As a hobby project there is no
formal SLA or bug-bounty.

## Threat model & accepted limitations

This is a client-authoritative, serverless arcade (no game server; the pure
reducer runs in each player's browser and writes state to Supabase). The
security posture is documented in `README.md` under **"Security model & trust
boundaries"**. Two properties are **accepted design limitations**, not bugs:

- **Hidden game information is readable by any room-code holder.** The full game
  state (Uno/CAH hands, the Codenames key, the Skribbl word) lives in one row
  readable via the code-gated `get_<game>` RPC. Competitive integrity is
  honor-system.
- **The `room_token` is per-room, not per-player.** It hardens the write path
  but is not player authentication; members can act as one another. The room
  code is effectively the full capability.

Reports about these two properties will be closed as by-design. Everything else
— injection, RLS/authorization bypass, resource-abuse beyond the documented
caps, XSS, dependency vulnerabilities — is in scope.
