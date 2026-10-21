"""Export the series both charts need to ../charts/data.json (run after prep.py)."""
import json, os
import numpy as np, pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
d = pd.read_csv(os.path.join(HERE, "data", "u5mr_long.csv"))
U = d.pivot(index="Country Code", columns="year", values="u5mr")
B = d.pivot(index="Country Code", columns="year", values="births")
name = d.drop_duplicates("Country Code").set_index("Country Code")["Country Name"]
YEARS = list(range(1960, 2020))


def wquant(x, w, q):
    o = np.argsort(x); cw = np.cumsum(w[o]) / w.sum()
    return float(np.interp(q, cw, x[o]))


def series(codes, start):
    out = []
    for c in codes:
        v = U.loc[c, start:2019]
        pts = [[int(y), round(float(u), 2)] for y, u in v.items() if pd.notna(u)]
        out.append({"code": c, "name": name[c], "v": pts})
    return out


# FOR: every country with data, births-weighted middle-80% band from 1970 (93%+ of births covered)
band = []
for y in range(1970, 2020):
    m = U[y].notna() & B[y].notna()
    x, w = U.loc[m, y].values, B.loc[m, y].values
    band.append({"y": y, "p10": round(wquant(x, w, .1), 2), "p50": round(wquant(x, w, .5), 2),
                 "p90": round(wquant(x, w, .9), 2), "over100": round(float(w[x > 100].sum() / w.sum()), 4)})

# AGAINST: fixed cohort of countries with 1960 data, mean of top and bottom tenth each year
cohort = U.index[U[1960].notna()]
tenths = []
for y in YEARS:
    x = np.sort(U.loc[cohort, y].dropna().values); k = round(len(x) / 10)
    tenths.append({"y": y, "top": round(float(x[-k:].mean()), 2), "bot": round(float(x[:k].mean()), 2)})

out = {
    "all": series(U.index[U.loc[:, 1960:2019].notna().any(axis=1)], 1960),
    "cohort": series(cohort, 1960),
    "band": band,
    "tenths": tenths,
    "n_cohort": int(len(cohort)),
}
os.makedirs(os.path.join(HERE, "..", "charts"), exist_ok=True)
json.dump(out, open(os.path.join(HERE, "..", "charts", "data.json"), "w"), separators=(",", ":"))

t0, t1 = tenths[0], tenths[-1]
print("countries", len(out["all"]), "cohort", len(cohort))
print("tenths 1960 top %.1f bot %.1f gap %.0f ratio %.1f" % (t0["top"], t0["bot"], t0["top"] - t0["bot"], t0["top"] / t0["bot"]))
print("tenths 2019 top %.1f bot %.1f gap %.0f ratio %.1f" % (t1["top"], t1["bot"], t1["top"] - t1["bot"], t1["top"] / t1["bot"]))
print("drop top %.0f%% bot %.0f%%" % (100 * (1 - t1["top"] / t0["top"]), 100 * (1 - t1["bot"] / t0["bot"])))
print("band 1970", band[0], "\nband 2019", band[-1])
for c in ["IND", "CHN", "NER", "NGA", "ISL", "JPN", "CAF", "SLE", "MLI"]:
    print(c, name[c], U.loc[c, [1960, 1970, 1990, 2019]].round(1).tolist(), "cohort" if c in cohort else "")
