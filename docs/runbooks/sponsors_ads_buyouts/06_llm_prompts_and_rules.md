# LLM Prompts and Rules — Sponsor Ops

When generating sponsor ops instructions, always anchor to:
1. `data/sponsor_intake/sponsors/<slug>/sponsor.json`
2. `data/buyouts.json`
3. the active sponsor assets folder

Do not instruct a VA to make a sponsor live by editing multiple config systems when one `data/buyouts.json` entry is sufficient.
