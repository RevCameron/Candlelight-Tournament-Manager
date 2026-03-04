# Candlelight-Tournament-Manager

Multiplayer Swiss Tournament Engine for Commander and SWU Twin Suns.

## Current Features
- Event setup with game mode selection and editable round count.
- Player registration with duplicate-name protection and Enter-to-add support.
- 3/4-player pod generation (no 2-player pods when a valid 3/4 split exists).
- Pod result entry with explicit per-player pod ranking (1..N) and All Draw reporting.
- **Fast result code input** in one tournament-level box for the current round:
  - Draw = `D`
  - Use `Pod:Code` format (example `1:1324, 2:D`)
- Pod-level lock after result submission, with **Edit Result** support on previous rounds.
- Round tabs so previous rounds stay accessible and editable.
- Round document generation:
  - **Print Pairings (First Name A-Z)**
  - **Print Match Slips** with ranking circles, tie code, seat map, and player signature lines
  - **Fast result code legend** printed on match slips for every possible ranking outcome
- Tournament-end document generation:
  - **Print Final Standings**
- Player management during the event:
  - **Edit Name**
  - **Drop Player**
  - **Eliminate Player**
  - **Re-activate Player**
- Standings with Match Points, OMW%, GW/TGW%, and OGW%.

## Notes
- Opponent-based percentages use a 33% minimum floor.
- This is a front-end-only prototype currently using in-memory tournament state.
- If print windows do not appear, allow browser popups for the site.
