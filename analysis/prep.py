"""Tidy the course's World Bank health file into one long table of countries x years."""
import pandas as pd, numpy as np
raw = pd.read_csv("data/health_raw.csv", skiprows=4)
meta = pd.read_csv("data/meta_country.csv", encoding="utf-8-sig")
countries = meta[meta.Region.notna()][["Country Code", "Region", "IncomeGroup"]]
IND = {"SH.DYN.MORT": "u5mr", "SH.DTH.MORT": "u5deaths", "SP.POP.TOTL": "pop", "SP.DYN.CBRT.IN": "cbr"}
r = raw[raw["Indicator Code"].isin(IND)].copy()
years = [str(y) for y in range(1960, 2020)]
long = r.melt(id_vars=["Country Name", "Country Code", "Indicator Code"], value_vars=years, var_name="year")
long["year"] = long.year.astype(int)
w = long.pivot_table(index=["Country Name", "Country Code", "year"], columns="Indicator Code", values="value").reset_index()
w = w.rename(columns=IND).merge(countries, on="Country Code")
w["births"] = w["pop"] * w["cbr"] / 1000
w.columns.name = None
w.to_csv("data/u5mr_long.csv", index=False)
print(w.shape, w["Country Code"].nunique())
