# Mais: four tables for AquaMaa's fast answers

## Why these tables matter
AquaMaa is getting a **fast path**. For the questions farmers and officers ask most, the answer will be worked out
from **your tables**, not by the AI model. The model only puts your facts into plain words. This makes answers
**5 to 10 seconds instead of 40 to 70**, and stops mistakes like "3,000 mg/L is below the 2,000 limit".
So every value you write must be **exact and sourced**: the system repeats it as fact.

## What to send
Fill in the four files below and **email them back to Roaa** (no need to use Git). Keep the file names and the
column names exactly as they are; change only the rows. Excel is fine: save as **CSV UTF-8** so Arabic stays readable.
Do them **in this order**; send each one as soon as it is ready, you don't need to wait for all four.

Deadline: **[Roaa: add the deadline]**

## Rules for every table
- **Use our sources first:** the files in `database/` on your laptop (you already have them). Write the file name and
  page, for example `FAO_29_Water_Quality_for_Agriculture_ch1-5.txt p.4`. A web source is fine if ours lack it:
  give the full link.
- **Copy numbers exactly** as the source writes them, with their unit. Don't round or convert.
- **Arabic:** simple Modern Standard Arabic, the way you would explain it to a farmer.
- **Not sure?** Leave the cell empty and write why in `note`. An empty cell is better than a guess.
- The first data row in each file is an **example**; replace or keep it if it is right.

---

## 1. `1_intent_questions.csv`: the questions people ask (most urgent)
AquaMaa recognises what kind of question it is by comparing it with these examples. **10 questions per intent**,
mixed: about 5 in English, 3 in Modern Standard Arabic, 2 in Qatari dialect. Write them the way real farmers and
officers would ask, short and natural, with spelling as people type.

| Column | What to write |
|---|---|
| `intent` | one of: `live_reading`, `suitability`, `statistic`, `law`, `explain` |
| `language` | `en`, `ar` or `ar-dialect` |
| `question` | the question |

What each intent means:
- `live_reading`: about the water being measured now ("what's the salinity now?", "is the pH okay right now?")
- `suitability`: can this water be used for something ("can I irrigate tomatoes with it?", "can camels drink it?")
- `statistic`: numbers about Qatar ("how many farm wells in Al Khor?", "how much groundwater do farms pump?")
- `law`: rules and permits ("do I need a licence for a new well?", "what is the fine for…?")
- `explain`: why or how something happens ("why is my well getting saltier?", "what is TDS?")

## 2. `2_meanings.csv`: what a reading means
For each sensor and each use, the ranges and what they mean. Ranges are read as **low ≤ value < high**; leave `low`
or `high` empty when there is no bound.

| Column | What to write |
|---|---|
| `sensor` | `tds`, `ph`, `temperature` or `turbidity` |
| `use` | `drinking`, `irrigation`, `livestock` or `general` |
| `low`, `high` | the range limits, numbers only |
| `unit` | `mg/L`, `pH`, `°C` or `NTU` |
| `level` | `good`, `caution` or `bad` |
| `meaning_en`, `meaning_ar` | one short sentence: what this range means for this use |
| `advice_en`, `advice_ar` | one short sentence: what the farmer can do |
| `source` | file and page, or a link |
| `note` | anything uncertain |

Must cover: TDS for drinking (WHO, GSO 149, Kahramaa), irrigation (FAO 29: 450 and 2,000 mg/L) and livestock (FAO 29);
pH for drinking (6.5-8.5) and irrigation (FAO 29); turbidity for drinking (WHO). Temperature: only if a source gives
a range that matters.

## 3. `3_crop_tolerance.csv`: how much salt each crop tolerates
From **FAO 29, Table 4** ("crop tolerance and yield potential … as influenced by irrigation water salinity (ECw)").
The full FAO 29 is online at https://www.fao.org/4/t0234e/T0234E03.htm . About **15 crops grown in Qatar**: date palm,
barley, wheat, sorghum, alfalfa, Rhodes grass (or the closest fodder grass in the table), tomato, cucumber, lettuce,
onion, pepper, potato, squash or zucchini, cantaloupe or melon, and one citrus.

| Column | What to write |
|---|---|
| `crop_en`, `crop_ar` | the crop's name |
| `group` | `field`, `vegetable`, `fruit` or `fodder` |
| `ecw_no_loss` | ECw (dS/m) at 100% yield potential, from the table |
| `ecw_half_loss` | ECw (dS/m) at 50% yield potential |
| `tolerance` | `sensitive`, `moderately sensitive`, `moderately tolerant` or `tolerant`, if the source rates it |
| `source` | table and page, or the link |
| `note` | anything uncertain |

Only ECw values, please, not ECe; AquaMaa converts them to mg/L itself.

## 4. `4_knowledge_cards.csv`: short facts for law and explanations
About **15 cards**, each one fact a farmer or officer may ask about, in one or two plain sentences.

| Column | What to write |
|---|---|
| `id` | C01, C02, … |
| `topic` | `law`, `cause`, `practice` or `definition` |
| `question_en`, `question_ar` | a typical question this card answers |
| `fact_en`, `fact_ar` | the answer in one or two plain sentences |
| `numbers` | every number in the fact, exactly as in the source, separated by `;` |
| `source` | file and page, or a link |
| `checked` | `yes` once you have read it in the source yourself |

Ideas: a licence is needed for every well; the penalty for an unlicensed well; the maximum withdrawal rate; wells
300 m apart; fodder irrigation with fresh groundwater needs approval; farmers don't pay for groundwater; why wells get
saltier (over-pumping and seawater moving inland); how fast the saline front moves; leaching salt from the root zone;
drip against flood irrigation and salt build-up; what TDS is; what the safe yield is; what brackish water is.
Most are in `ANND_Right_to_Water_in_Qatar.txt`, `Elobaid_2017_EGU_saline_front_Qatar.txt`, `FAO_29_…`, `glossary.csv`
and `misconceptions.csv`.

Thank you! Ask Roaa if anything is unclear.
