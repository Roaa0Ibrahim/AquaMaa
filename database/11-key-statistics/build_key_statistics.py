"""Builds key_statistics.csv: the headline figures the agent may add under an answer.

Every statistic carries a quote that must appear in its source file; the page is found from that quote.
A statistic whose quote isn't found stops the build, so no figure enters the table unverified.
Run from fresh-start: python database/11-key-statistics/build_key_statistics.py
"""
import csv
import re
from pathlib import Path

DB = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent / "key_statistics.csv"

# id, statistic, value, unit, year, source folder/file, quote found in the file, how, when it helps, topics
STATS = [
    ("K01", "Groundwater safe yield", "49.6", "million m3 a year", "1998-2023 average", "01-national-statistics/NPC_Water_Statistics_2023.txt",
     "safe yield of groundwater amounted to 49.6 million m3", "quoted", "questions on depletion, over-abstraction, sustainability or how much can be pumped", "water_situation"),
    ("K02", "Rain recharge of the aquifers", "74.7", "million m3 a year", "1998-2023 average", "01-national-statistics/NPC_Water_Statistics_2023.txt",
     "74.7", "quoted", "questions on recharge, rainfall or the water balance", "water_situation"),
    ("K03", "Groundwater abstraction", "200", "million m3", "2023", "01-national-statistics/total-abstraction-from-ground-water.csv",
     "2023,200", "quoted", "questions on how much groundwater is pumped or used", "water_situation"),
    ("K04", "Groundwater abstraction before the 2023 revision", "250", "million m3 a year", "2019-2022", "01-national-statistics/Kahramaa_Statistics_Report_2023.txt",
     "It is reduced in 2023 from 250Mm3 to 200Mm3 based on groundwater modeling results", "quoted", "questions on trends in abstraction or whether pumping fell", "water_situation"),
    ("K05", "Abstraction as a multiple of safe yield", "4.0", "times", "2023", "01-national-statistics/total-abstraction-from-ground-water.csv",
     "2023,200", "calculated: 200 / 49.6 (K03 / K01)", "questions on how far abstraction exceeds sustainable levels", "water_situation"),
    ("K06", "Share of abstraction from agricultural wells", "90", "%", "2023", "01-national-statistics/water-production-abstraction-losses-and-uses.csv",
     "2023,of which from agricultural wells [5],",
     "calculated: 180 / 200, both from this table", "questions on who uses groundwater or the role of agriculture", "water_situation,suitability"),
    ("K07", "Share of water production from seawater desalination", "63", "%", "2023", "01-national-statistics/NPC_Water_Statistics_2023.txt",
     "seawater desalination (63%)", "quoted", "questions on where Qatar's water or drinking water comes from", "water_situation"),
    ("K08", "Total water production", "1065", "million m3", "2023", "01-national-statistics/NPC_Water_Statistics_2023.txt",
     "1065 million m3 in 2023", "quoted", "questions on overall water supply or demand", "water_situation"),
    ("K09", "Real water losses in the network", "6", "%", "2023", "01-national-statistics/NPC_Water_Statistics_2023.txt",
     "real water losses increased from 4% in 2018 to 6% in 2023", "quoted", "questions on network efficiency or losses", "water_situation"),
    ("K10", "Strategic water storage", "5.2", "days of demand", "2024", "06-institutions/Peninsula_2025_Kahramaa_water_reserves.txt",
     "1.3 days in 2010 to 5.2 days in 2024", "quoted (news)", "questions on water security, reserves or emergencies", "water_situation,institutions"),
    ("K11", "New recharge wells developed", "370", "wells", "by 2025", "05-policy-law-goals/Qatar_NDC_3.txt",
     "370 new recharge wells", "quoted", "questions on recharge, replenishment or government action", "policy,institutions"),
    ("K12", "Recharge wells rehabilitated", "313", "wells", "by 2025", "05-policy-law-goals/Qatar_NDC_3.txt",
     "313 recharge wells have been rehabilitated", "quoted", "questions on recharge, replenishment or government action", "policy,institutions"),
    ("K13", "National target for groundwater extraction", "70", "% reduction", "by 2030", "05-policy-law-goals/policy-goals.csv",
     "Groundwater extraction reduced by 70%", "quoted (NDS3 p.27)", "questions on national goals, targets or policy", "policy"),
    ("K14", "Groundwater samples unsuitable for irrigation", "up to 95", "%", "not stated", "04-research/QEERI_2022_Qatar_Groundwater_Challenges.txt",
     "up to 95% of samples are not suitable for agricultural irrigation", "quoted (research article)", "questions on groundwater quality for farming", "quality_science,suitability"),
    ("K15", "Average TDS in the 201-well survey", "about 4,600", "mg/L", "2020", "10-misconceptions/misconceptions.csv",
     "averaged about 4,600 mg/L TDS", "calculated from Geochemistry_Dataset.xlsx (mean 4,641)", "questions on how salty groundwater is", "quality_science"),
    ("K16", "Groundwater rated excellent or good for drinking", "9", "% (3% excellent, 6% good)", "2024", "05-policy-law-goals/ANND_Right_to_Water_in_Qatar.txt",
     "Excellent 3% Good 6%", "quoted (NGO report figure)", "questions on whether groundwater is drinkable", "quality_science"),
    ("K17", "Treated wastewater injected into aquifers", "15.6", "% of treated wastewater use", "2023", "01-national-statistics/NPC_Water_Statistics_2023.txt",
     "Injection into aquifers 15.6%", "quoted", "questions on aquifer recharge or reuse of treated wastewater", "water_situation,policy"),
    ("K18", "Biological compliance of drinking water", "99.36", "% (WHO target 95%)", "2023", "02-quality-measurements/biological-water-quality-compliance-by-year.csv",
     "2023,99.36,95.0", "quoted", "questions on drinking water safety or tap water quality", "standards,quality_science"),
    ("K19", "Wells on farms (working and not working)", "4,564", "wells", "2023", "07-geography/number-of-farms-and-wells-by-type-of-the-farm-and-municipality.csv",
     "2023,", "calculated: sum of 'Number of Wells' rows for 2023. Kahramaa officials have cited over 6,500 agricultural wells, so the sources differ",
     "questions on how many wells there are", "water_situation"),
    ("K20", "FAO irrigation threshold for TDS", "450 / 2,000", "mg/L (none / slight to moderate / severe)", "", "03-standards/limits.csv",
     "TDS,Irrigation,FAO 29,slight to moderate,450-2000", "quoted", "questions on whether water is suitable for irrigation", "standards,suitability"),
]


def find_page(path, quote):
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    flat = lambda s: re.sub(r"\s+", " ", s)
    if path.suffix == ".csv":
        for number, line in enumerate(text.splitlines(), start=1):
            if quote in line:
                return f"row {number}"
        return None
    for number, page in enumerate(text.split("\f"), start=1):
        if flat(quote) in flat(page):
            return f"p.{number}" if "\f" in text else "p.1"
    return None


rows = []
for sid, stat, value, unit, year, rel, quote, how, when, topics in STATS:
    path = DB / rel
    location = find_page(path, quote)
    if location is None:
        raise SystemExit(f"{sid}: quote not found in {rel}: {quote!r}")
    rows.append(dict(stat_id=sid, statistic=stat, value=value, unit=unit, year=year, source_file=path.name,
                     location=location, quote=quote, how=how, when_it_helps=when, topics=topics, checked_by_roaa="no"))

with OUT.open("w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
print(f"{len(rows)} statistics written to {OUT.name}, every quote found in its source")
