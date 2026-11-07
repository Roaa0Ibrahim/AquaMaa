# AquaMaa database

Built 7 November 2026. Files are in folders by **data type**, and each source is tagged with **topics** in `sources.json`.

- **`sources.json`:** one entry per source, with its files, publisher, year, data period, URL, authority, evidence status, licence, topics and notes.
- **Paired files:** each PDF has a `.txt` copy beside it, for searching. Web pages are stored as `.txt` only.
- **Tables** (`.csv`, `.xlsx`) are for the structured lookup and are never chunked.

## Folders
| Folder | Sources | Why these |
|---|---|---|
| 01-national-statistics | 5 | NPC 2023 is the newest official report and Kahramaa 2023 is the operator's own. PSA 2021 shows the earlier method, for comparison. Two key tables cover abstraction and the full water balance |
| 02-quality-measurements | 5 | The 201-well survey from 2020, as raw values and as indicators: the only well-level groundwater data we have. Three official tables add pollution, drinking-water compliance and coastal water |
| 03-standards | 5 | Our limits table, plus its four sources: Kahramaa 2014, FAO 29 (chapters 1-5, including crop salt tolerance), the WHO tables and GSO 149 |
| 04-research | 5 | QEERI 2022 (the problem statement's source), Higazy 2024, Mohieldeen 2021, Elobaid 2017 (salinity trends, preliminary), and the MWDVF methods |
| 05-policy-law-goals | 5 | NDS3, QNV 2030, NDC 3.0, the food security strategy, and ANND for the law and licensing |
| 06-institutions | 5 | Two Fanack summaries of who does what, and three 2025 news items on Kahramaa's programmes |
| 07-geography | 5 | Municipality boundaries, well coordinates, farms and wells by municipality, population by municipality, and FAO AQUASTAT |
| 08-sensors | 5 | Datasheets for the TDS, pH, turbidity and temperature sensors, and the ESP32 ADC reference |
| 09-glossary | 3 | USGS dictionary, WHO TDS background, and our draft `glossary.csv` (25 terms) |
| 10-misconceptions | 1 file, 8 entries | Our draft `misconceptions.csv`. Each entry cites the file that corrects it |

Topic coverage, as counted from `sources.json`:

| Topic | Sources |
|---|---|
| water_situation | 15 |
| suitability | 11 |
| quality_science | 11 |
| institutions | 10 |
| standards | 8 |
| policy | 8 |
| glossary | 7 |
| sensors | 6 |

## Important notes
- **Mais's sample is the MWDVF geochemistry file.** `Geochemistry_Dataset.xlsx` is identical to Mais's `DOC-20261104-WA0008.xlsx` and to the team's `datasets` folder. The data comes from Shomar and Sankaran (2024), *Ground Water* 62, [doi:10.1111/gwat.13411](https://doi.org/10.1111/gwat.13411), by way of Qatar_MWDVF. That repository has **no open licence**: cite it, and keep it private.
- **All 201 wells are from 2020.** That means no trends, so Milestone 11's trend tests need other series.
- **The Kahramaa 2014 requirements apply to desalinated supply,** not groundwater.
- **News and Fanack items are secondary sources.** Prefer official documents when they disagree.
- **Two drafts still need checking:**
  - **Glossary:** each term's Arabic must be checked by a native speaker, using the `arabic_checked_by_native_speaker` column.
  - **Misconceptions:** each entry must be checked by Roaa, using the `checked_by_roaa` column.

## To download in a browser
These sites load their files through JavaScript, so they couldn't be downloaded automatically:

| Item | Folder | Link |
|---|---|---|
| ESCWA *Glossary of Shared Water Resources*, English-Arabic, 2012 | 09-glossary | [UN Digital Library](https://digitallibrary.un.org/record/1292660) |
| Aloui et al. 2023, groundwater resources in Qatar, review, open access | 04-research | [doi:10.1016/j.ejrh.2023.101564](https://doi.org/10.1016/j.ejrh.2023.101564) |
| Ahmad et al. 2020, hydrogeochemistry of Qatari groundwater | 04-research | [QSpace](https://qspace.qu.edu.qa/handle/10576/31202) |
| WHO *Guidelines for Drinking-water Quality*, 4th ed. with addenda | 03-standards | [WHO](https://www.who.int/publications/i/item/9789240045064) |

## Left out
- **The Amiri Decision 46/2015** is a scanned Arabic PDF that needs OCR.
- **Darge 2024** studies Texas, not Qatar.
- **The other 59 open datasets** remain in `context/reference/datasets/`, available to the structured lookup when needed.
