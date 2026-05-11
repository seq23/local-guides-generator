# Buyout Tiers and Conflicts (Training v1)

## Products
- City Buyout
- State Buyout
- Vertical Buyout

## Conflict rule
If a market is already bought out, a broader package does not silently override it.

## Training rule
Training uses fake sponsor data but the same record + activation model:
- sponsor record
- sponsor assets
- one live entry in `data/buyouts.json`
