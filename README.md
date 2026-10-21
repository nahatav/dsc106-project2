# DSC 106 Project 2: Persuasive or Deceptive Visualization?

**Proposition:** Under-five mortality rates are converging across countries.

Live report: https://nahatav.github.io/dsc106-project2/

Builds on the group checkpoint in [vsinha99/dsc106-project2](https://github.com/vsinha99/dsc106-project2): same data file, same 112-country matched cohort, nearest-rank P10/P90, unweighted.

- `index.html`: the report
- `images/`: final figures (`for1`, `for2`, `against1`, `against2`, plus `_reveal` versions with numbered decision markers)
- `charts/chart.html`: D3 source for all figures (`?v=for1|for2|against1|against2`, add `&reveal` for markers; `?v=morph` is the interactive linear/log figure); `charts/data.json` is its data
- `analysis/export.py`: computes everything in `data.json` from `analysis/data/aid-effectiveness/`
- `analysis/render.sh`: re-exports the PNGs with headless Chrome (needs a local server on port 6001)
- `analysis/prep.py`, `explore*.py`: earlier exploration on the raw health indicators (not used by the final figures)

Rebuild: `python analysis/export.py`, then serve the repo on port 6001 and run `bash analysis/render.sh`.
