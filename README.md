# DSC 106 Project 2: Persuasive or Deceptive Visualization?

**Proposition:** Under-five mortality rates are converging across countries.

Live report: https://nahatav.github.io/dsc106-project2/

- `index.html`: the report
- `images/`: exported figures (`for`, `against`, plus `_reveal` versions with numbered decision markers)
- `charts/chart.html`: the D3 source for both figures (`?v=for`, `?v=against`, add `&reveal` for markers); `charts/data.json` is its data
- `analysis/prep.py` → `analysis/export.py`: data pipeline; `analysis/render.sh` re-exports the PNGs (needs a local server on port 6001)
- `analysis/explore.py`, `analysis/explore2.py`: exploratory convergence statistics

Data: World Bank WDI via [light-and-salt/World-Bank-Data-by-Indicators](https://github.com/light-and-salt/World-Bank-Data-by-Indicators). To rebuild, download `health/health-raw-2021.csv` into `analysis/data/health_raw.csv`, then run `python analysis/prep.py && python analysis/export.py`.
