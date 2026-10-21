import pandas as pd, numpy as np
d = pd.read_csv("data/u5mr_long.csv").dropna(subset=["u5mr"])
P = d.pivot(index="Country Code", columns="year", values="u5mr")
name = d.drop_duplicates("Country Code").set_index("Country Code")[["Country Name","Region","IncomeGroup"]]
for start in (1960, 1990):
    c = P[P[start].notna()]
    print(f"\ncohort {start}: n={len(c)}")
    for y in [start, 1980, 1990, 2000, 2010, 2019]:
        if y < start: continue
        x = c[y]; print(y, "p10 %.1f p90 %.1f gap %.1f ratio %.1f sd %.1f cv %.2f sdlog %.2f" % (x.quantile(.1), x.quantile(.9), x.quantile(.9)-x.quantile(.1), x.quantile(.9)/x.quantile(.1), x.std(), x.std()/x.mean(), np.log(x).std()))
c = P[P[1990].notna()]
arr = lambda a, b, y0, y1: -np.log(c[y1]/c[y0])/(y1-y0)*100
df = pd.DataFrame({"u90": c[1990], "u19": c[2019], "abs_drop": c[1990]-c[2019], "arr_90_19": arr(0,0,1990,2019), "arr_90_00": arr(0,0,1990,2000), "arr_00_10": arr(0,0,2000,2010), "arr_10_19": arr(0,0,2010,2019)}).join(name)
df["q"] = pd.qcut(df.u90, 5, labels=["Q1 lowest","Q2","Q3","Q4","Q5 highest"])
print(df.groupby("q")[["u90","u19","abs_drop","arr_90_19","arr_90_00","arr_00_10","arr_10_19"]].median().round(2))
print("corr(u90, abs_drop)=%.2f  corr(log u90, arr)=%.2f" % (df.u90.corr(df.abs_drop), np.log(df.u90).corr(df.arr_90_19)))
print(df.groupby("Region")[["u90","u19","arr_90_00","arr_00_10","arr_10_19"]].median().round(1))
# rank persistence
b90 = set(df.nlargest(20,"u90").index); b19 = set(df.nlargest(20,"u19").index)
print("worst20 1990 still worst20 2019:", len(b90 & b19)); print(df.nlargest(15,"u19")[["Country Name","u90","u19","arr_10_19"]].round(1))
print(df.nsmallest(10,"u19")[["Country Name","u90","u19"]].round(1))
# regional aggregates from raw
agg = pd.read_csv("data/health_raw.csv", skiprows=4); agg = agg[agg["Indicator Code"]=="SH.DYN.MORT"].set_index("Country Code")
print(agg.loc[["WLD","SSF","HIC","LIC","EUU","SAS","EAS"], ["Country Name","1960","1990","2000","2010","2019"]])
