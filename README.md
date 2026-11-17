# Hanoi — Tower of Hanoi (Prolog backend)

A responsive browser game with a vanilla HTML/CSS/JavaScript frontend and an SWI-Prolog HTTP backend. Prolog owns the puzzle state, validates legal moves, handles undo, and computes the optimal solution.

## Requirements
- SWI-Prolog (with the HTTP libraries included)
- A modern browser

## Run
1. Install SWI-Prolog from https://www.swi-prolog.org/download/stable
2. Open a terminal in this project folder.
3. Start the server:

   ```bash
   swipl -s server.pl
   ```

4. Open http://localhost:8080

The Prolog server serves the frontend and API from the same origin, so no separate frontend server or CORS setup is needed.

## API
- `GET /api/state` — current game state
- `POST /api/new` — `{"disks": 4}` (3–8 disks)
- `POST /api/move` — `{"from":"a","to":"c"}`; rejects illegal moves
- `POST /api/undo` — undo the last move
- `GET /api/solve` — return the optimal sequence

## Notes
- The server currently holds one shared game state. This is ideal for a local single-player demo. For public multi-user deployment, add per-session game IDs and isolate state per user.
- The game uses the standard minimum-move formula `2^n - 1`.
