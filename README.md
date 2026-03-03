# Candlelight-Tournament-Manager

Multiplayer Swiss Tournament Engine for Commander and SWU Twin Suns.

## Current Features
- Event setup with game mode selection and editable round count.
- Player registration with duplicate-name protection and Enter-to-add support.
- 3/4-player pod generation (no 2-player pods when a valid 3/4 split exists).
- Pod result entry with explicit Winner, Loser, and All Draw reporting.
- Pod-level lock after result submission.
- Manual next-round generation only after all pods are reported.
- Standings with Match Points, OMW%, GW/TGW%, and OGW%.

## Notes
- Opponent-based percentages use a 33% minimum floor.
- This is a front-end-only prototype currently using in-memory tournament state.
