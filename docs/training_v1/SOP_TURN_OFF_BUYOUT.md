# SOP — TURN OFF BUYOUT (NEXT STEPS MECHANISM) — OWNER ONLY

## File to edit
`data/buyouts.json`

## Steps
1) Find the buyout record by `id`
2) Set:
```json
"live": false
```
3) Save

## Verify
```bash
npm run validate:all
npm run smoke:buyouts
npm run audit:buyouts
```

## Confirm in browser (spot check)
- Scoped pages no longer show Next Steps CTA
- Competing conversion surfaces are restored (as applicable)
