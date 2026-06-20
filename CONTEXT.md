# Library Games

Domain glossary for the project. Today it covers the online-multiplayer context (Supabase-backed rooms); single-player games add no shared domain language. Keep this a glossary — definitions only, no implementation detail.

## Online multiplayer

**Room**:
A single live session of one online game, identified by a short code, that players create and join. Holds the whole game's serialized state plus a version.
_Avoid_: lobby (that's one phase of a room), match, session (session means the 24h client-side resume token).

**State bus**:
The shared channel through which every player's browser reads and writes the room's state. There is no game server — the same reducer runs in each browser and writes the next state back.
_Avoid_: server, backend.

**Redaction**:
Hiding another player's secret information (e.g. opponents' hands) from the local view. **Display-only**: the full state is broadcast to every client, so redaction governs only what a browser renders, never what it knows or writes.
_Avoid_: hiding, masking, filtering, secrecy (redaction is not a security boundary).

**Leave action**:
The single action representing a player leaving a room (typically removing themselves). Each game declares its own; the room runs it through the shared commit on leave.
_Avoid_: disconnect, quit, exit.

**Commit**:
Writing the next state to the room via a compare-and-swap on the version, retrying on conflict. The one path every state change funnels through, whether from a normal move or from leaving.
_Avoid_: save, update, sync, dispatch (dispatch is one caller of commit, not a synonym).
