"""Export everything the two final figures need to ../charts/data.json.

Follows the group's checkpoint method (vsinha99/dsc106-project2) exactly:
- data: World Bank pre-cleaned aid-effectiveness.csv + country metadata (countries = rows with a Region)
- matched cohort: countries with an under-five mortality rate in both 1960 and 2019 (n = 112)
- yearly P10 / median / P90 over that cohort, P10 and P90 by nearest rank, unweighted
- 2019 regional cross-section over every country with a 2019 rate (n = 193)
"""
import csv, json, math, os
from statistics import median

HERE = os.path.dirname(os.path.abspath(__file__))
FOLDER = os.path.join(HERE, "data", "aid-effectiveness")
INDICATOR = "average_value_Mortality rate, under-5 (per 1,000 live births)"


def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def quantile_nearest(values, p):
    vals = sorted(values)
    return vals[max(0, math.ceil(p * len(vals)) - 1)]


meta = next(f for f in os.listdir(FOLDER) if f.startswith("Metadata_Country_"))
regions = {r["Country Code"]: r["Region"].strip() for r in read_csv(os.path.join(FOLDER, meta)) if r.get("Region", "").strip()}
series, names = {}, {}
for row in read_csv(os.path.join(FOLDER, "aid-effectiveness.csv")):
    code = row.get("Country Code", "")
    if code not in regions:
        continue
    try:
        val, year = float(row[INDICATOR]), int(row["Year"])
    except (ValueError, KeyError, TypeError):
        continue
    if math.isfinite(val):
        series.setdefault(code, {})[year] = val
        names[code] = row["Country Name"]

cohort = {c: v for c, v in series.items() if 1960 in v and 2019 in v}
stats = []
for year in range(1960, 2020):
    vals = [v[year] for v in cohort.values() if year in v]
    p10, p90 = quantile_nearest(vals, 0.1), quantile_nearest(vals, 0.9)
    stats.append({"y": year, "n": len(vals), "p10": p10, "med": median(vals), "p90": p90, "gap": p90 - p10, "ratio": p90 / p10})

# all countries reporting in each year (not a fixed sample), for the interactive builder
stats_all = []
for year in range(1960, 2020):
    vals = [v[year] for v in series.values() if year in v]
    p10, p90 = quantile_nearest(vals, 0.1), quantile_nearest(vals, 0.9)
    stats_all.append({"y": year, "n": len(vals), "p10": p10, "p90": p90, "gap": p90 - p10, "ratio": p90 / p10})

changes = {c: 100 * (v[1960] - v[2019]) / v[1960] for c, v in cohort.items()}
bins = [[lo, sum(lo <= x < lo + 10 for x in changes.values()) if lo < 90 else sum(lo <= x <= 100 for x in changes.values())] for lo in range(50, 100, 10)]

reg2019 = {}
for c, v in series.items():
    if 2019 in v:
        reg2019.setdefault(regions[c], []).append({"code": c, "name": names[c], "v": v[2019]})
regions_out = []
for r, pts in reg2019.items():
    vals = [p["v"] for p in pts]
    regions_out.append({"region": r, "n": len(vals), "med": median(vals), "p10": quantile_nearest(vals, 0.1), "p90": quantile_nearest(vals, 0.9), "pts": sorted(pts, key=lambda p: p["v"])})
regions_out.sort(key=lambda r: r["med"])

out = {
    "cohort": [{"code": c, "name": names[c], "v": sorted([[y, round(x, 2)] for y, x in v.items() if 1960 <= y <= 2019])} for c, v in cohort.items()],
    "stats": [{k: (round(x, 3) if isinstance(x, float) else x) for k, x in s.items()} for s in stats],
    "stats_all": [{k: (round(x, 3) if isinstance(x, float) else x) for k, x in s.items()} for s in stats_all],
    "bins": bins,
    "n_improved": sum(v[2019] < v[1960] for v in cohort.values()),
    "median_change": round(median(changes.values()), 2),
    "min_change": round(min(changes.values()), 2),
    "regions": regions_out,
    "n_2019": sum(r["n"] for r in regions_out),
}
os.makedirs(os.path.join(HERE, "..", "charts"), exist_ok=True)
json.dump(out, open(os.path.join(HERE, "..", "charts", "data.json"), "w"), separators=(",", ":"))

s0, s1 = stats[0], stats[-1]
peak = max(stats, key=lambda s: s["ratio"])
print(f"cohort {len(cohort)}; 1960 P10 {s0['p10']:.2f} med {s0['med']:.2f} P90 {s0['p90']:.2f} gap {s0['gap']:.2f} ratio {s0['ratio']:.2f}")
print(f"2019 P10 {s1['p10']:.2f} med {s1['med']:.2f} P90 {s1['p90']:.2f} gap {s1['gap']:.2f} ratio {s1['ratio']:.2f}; gap change {100*(s1['gap']/s0['gap']-1):.1f}%")
print(f"peak ratio {peak['ratio']:.2f} in {peak['y']}; improved {out['n_improved']}/{len(cohort)}; median change {out['median_change']}%, min {out['min_change']}%; bins {bins}")
for r in regions_out:
    print(f"  {r['region']}: n={r['n']} med={r['med']:.1f} p10={r['p10']:.1f} p90={r['p90']:.1f}")
print("n 2019", out["n_2019"])
lo = min(changes, key=changes.get)
print("smallest reduction:", names[lo], round(changes[lo], 1), cohort[lo][1960], cohort[lo][2019])
