import pandas as pd, numpy as np
d = pd.read_csv("data/u5mr_long.csv").dropna(subset=["u5mr"])
print("pop/cbr/deaths coverage 2019:", d[d.year==2019][["pop","cbr","u5deaths","births"]].notna().sum().to_dict())
def wq(x, w, q):
    o = np.argsort(x); x, w = x[o], w[o]; c = np.cumsum(w)/w.sum(); return np.interp(q, c, x)
rows = []
for y, g in d.groupby("year"):
    x = g.u5mr.values; b = g.births.fillna(0).values
    s = np.sort(x); n = len(x)
    rows.append(dict(year=y, n=n, mean=x.mean(), sd=x.std(), cv=x.std()/x.mean(), sdlog=np.log(x).std(),
        p10=np.percentile(x,10), p90=np.percentile(x,90), gap9010=np.percentile(x,90)-np.percentile(x,10),
        ratio9010=np.percentile(x,90)/np.percentile(x,10), mx=x.max(), mn=x.min(), maxmin=x.max()/x.min(),
        top10_bot10=s[-10:].mean()/s[:10].mean(),
        wsd=np.sqrt(np.average((x-np.average(x,weights=b))**2, weights=b)) if b.sum()>0 else np.nan,
        wp10=wq(x,b,.1), wp90=wq(x,b,.9), share_births_over50=b[x>50].sum()/b.sum(), share_births_over100=b[x>100].sum()/b.sum(),
        n_over100=(x>100).sum(), n_under25=(x<25).sum()))
s = pd.DataFrame(rows).set_index("year")
pd.set_option("display.width", 250); print(s.loc[[1960,1970,1980,1990,2000,2005,2010,2015,2019]].round(3).to_string())
# fixed cohort of countries with 1990 data
