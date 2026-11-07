# AquaMaa research notes

Background for our decisions. Source details are in [sources.csv](sources.csv), and water limits are in [limits.csv](limits.csv).

## Numbers to use

| Fact | Value | Source |
|---|---|---|
| Estimated groundwater abstraction, 2019-2022 | 250 million m³ a year, from earlier studies | [RP-04, Kahramaa p.81](https://km.qa/MediaCenter/Publications/SR2023-English.pdf) |
| Estimated groundwater abstraction, 2023 and 2024 | 200 million m³ a year, revised using groundwater modeling | [RP-04, Kahramaa p.81](https://km.qa/MediaCenter/Publications/SR2023-English.pdf) |
| Estimated share from farm wells, 2023 and 2024 | 180 of 200, or 90% | [DS-02, Kahramaa](https://www.data.gov.qa/explore/dataset/total-water-storage-2023/) |
| Rain recharge, long-term average 1998-2023 | 74.7 million m³ a year | [RP-10, NPC](https://www.npc.qa/en/statistics/Statistical%20Releases/Environmental/Water/Water_Statistics_2023_EN.pdf) |
| Groundwater safe yield | 49.6 million m³ a year (74.7 recharge - 25.1 outflow, 1998-2023). The 2021 edition gave 54.2. | [RP-10, NPC](https://www.npc.qa/en/statistics/Statistical%20Releases/Environmental/Water/Water_Statistics_2023_EN.pdf) |
| Groundwater balance | -3 in 2018, -184 in 2021, -49 in 2023 (million m³). 2023 uses modeled values, and rainfall that year was 166% of the long-term average. | [RP-10, NPC](https://www.npc.qa/en/statistics/Statistical%20Releases/Environmental/Water/Water_Statistics_2023_EN.pdf) |
| Wells on working farms, 2023 | 4,377 on 1,068 farms (my sum across size classes) | [DS-08, Ministry of Municipality](https://www.data.gov.qa/explore/dataset/number-of-farms-and-wells-by-farm-status-and-number-of-wells-class/) |
| Kahramaa potable well fields, 2024 | 322 wells across five fields, with average output listed as 0 | [DS-10, Kahramaa](https://www.data.gov.qa/explore/dataset/potable-water-production-capacities-from-wells-and-reverse-osmosis-ro/) |
| 205-well survey | Average TDS 4,598 mg/L, nitrate above 50 mg/L in 11 wells | [RS-01, Shomar & Sankaran 2024](https://www.pubmed.ncbi.nlm.nih.gov/38629132/) |
| Same 205 samples | Mean SAR 10.1, mean EC 7,250 µS/cm | [RS-02, Kuiper et al.](https://pure.kfupm.edu.sa/en/publications/high-levels-of-molybdenum-in-qatars-groundwater-and-potential-imp/) |

Abstraction figures are estimates, not meter readings. Kahramaa says flowmeters will be installed in each well in the coming three years ([RP-04](https://km.qa/MediaCenter/Publications/SR2023-English.pdf)). So 250 to 200 is a revised estimate, and it does not show that pumping fell. The 92% farm share comes from the earlier 230 of 250.

## Where sources disagree

| Topic | The conflict | What to do |
|---|---|---|
| Drinking suitability | The survey says all 205 wells are undrinkable ([RS-01](https://www.pubmed.ncbi.nlm.nih.gov/38629132/)). Aloui et al. rate 9.1% of their area excellent to good ([RS-03](https://doi.org/10.1016/j.indic.2025.100582)). | Quote each with its study. Different methods mean they aren't directly comparable. |
| Irrigation suitability | Kuiper et al. warn of soil and yield harm ([RS-02](https://pure.kfupm.edu.sa/en/publications/high-levels-of-molybdenum-in-qatars-groundwater-and-potential-imp/)). Aloui et al. rate 31.1% high to very high ([RS-03](https://doi.org/10.1016/j.indic.2025.100582)). | Same. This also supports your "conditional" outcome. |
| Water injected into aquifers, 2021 | 69.21 million m³ ([DS-06](https://www.data.gov.qa/explore/dataset/aggregate-water-use-balance-million-m3/)) against 54.7 ([DS-07](https://www.data.gov.qa/explore/dataset/wastewater-treatment-and-reuse-statistics-by-year/)). | Don't quote a single figure without checking. Definitions may differ. |
| Environment strategy says 60%, NDS3 says 70% for groundwater extraction | The 60% comes from 2021 press coverage. The [NDC, p.24](https://unfccc.int/sites/default/files/2025-11/Qatar%20NDC%203.0.pdf) says the strategy "has been updated and aligned with the NDS-3". | The 70% may be the newer target, but I haven't seen the updated strategy. Name the source each time. |
| New recharge wells | 70 in press coverage, 370 in the [NDC, p.18](https://unfccc.int/sites/default/files/2025-11/Qatar%20NDC%203.0.pdf) | Use the NDC figure, as the official source. |
| TDS and WHO | The UDST review says WHO recommends below 1000 mg/L ([UD-06](https://doi.org/10.1007/s12665-026-13023-y)). The WHO tables read here give no health-based TDS value ([ST-04](https://support.esdat.net/Environmental%20Standards/who/who_4th_edition_tables.pdf)). | Describe 1000 mg/L as a taste or acceptability level, and check WHO's wording. Its authors may be on your panel. |

## Not found

- Openly licensed well-by-well quality data. A [research repository](https://github.com/Kagiso-S-More/Qatar_MWDVF) holds 201 locations but has no open licence. It is downloaded to [Qatar_MWDVF/](Qatar_MWDVF/SOURCE.txt) for reference.
- Qatar's numeric limits for treated-effluent reuse.
- A Qatar groundwater quality standard.
- The law's implementing regulation, and a complete readable copy of the law. Al Meezan blocks automated reading, so only Articles 2 and 76 were seen, through search excerpts.
- MECC's specific groundwater duties. The [NDC](https://unfccc.int/sites/default/files/2025-11/Qatar%20NDC%203.0.pdf) confirms its strategy covers "protecting, monitoring, and enhancing environmental components" and that it coordinates climate adaptation, but it doesn't assign it groundwater monitoring.
- The current status of Kahramaa's aquifer storage project and whether Aqua-Intelligence is still open.
- Whether your exact sensors match the models in the hardware notes.

## ANND report: claims traced to their sources

I read the [full report](source-documents/ANND_Right_to_Water_in_Qatar.pdf) and checked its main claims.

| Report's claim | Traced to | Result |
|---|---|---|
| Abstraction "declined significantly" in 2023 | [Kahramaa 2023, p.81](https://km.qa/MediaCenter/Publications/SR2023-English.pdf) | **Misleading.** It's a revised estimate based on modeling. |
| Natural recharge of about 54.2 million m³ | [PSA 2021](https://www.npc.qa/en/statistics/Statistical%20Releases/Environmental/Water/Water_Statistics_2021_EN.pdf) | Confirmed, as the safe yield. |
| Central database, with public access on request | [Law 23 of 2025, Art. 2](https://www.almeezan.qa/LawView.aspx?opt=&LawID=10163&language=ar) | **Mostly confirmed.** The law requires a database linked to geographic information, available to government and the public under controls in the regulation. I couldn't confirm "legitimate case". [Amiri Decision 46 of 2015](source-documents/Amiri_Decision_46_2015.pdf) tasks Kahramaa with creating that database. |
| Polluting water: up to 15 years and QAR 1 million (Art. 76) | [Law 23 of 2025](https://www.almeezan.qa/LawView.aspx?opt=&LawID=10163&language=ar) | Penalty confirmed. It applies to Articles 7(1), 52 and 62. |
| Other articles on wells and penalties | Same law | Not confirmed. Only cited by the report. |
| Law adopted 19 October 2025 | Same law | The law is dated 5 October. It was published in the Gazette on 19 October. |
| 977 groundwater, 83 desalinated and 18 TSE farms | [Census 2021](https://www.mm.gov.qa/cs/groups/public/documents/mmportal/njiw/mdqz/~edisp/mmpwcwsc011620043212.pdf) | Groundwater and desalinated confirmed. TSE was unclear in the extracted table. |
| Drinking and irrigation suitability percentages | [Aloui et al. 2025](https://doi.org/10.1016/j.indic.2025.100582) | Consistent. These are shares of surface area, not of wells or water. |
| TSE injection peaked at 79.7 million m³ in 2019 | [DS-07](datasets/wastewater-treatment-and-reuse-statistics-by-year.csv) | Confirmed. |
| Subsidence of 2-5 mm a year in some areas, from injected water | [Darge et al. 2024](https://doi.org/10.1016/j.scitotenv.2024.177061) | **Doesn't apply.** The study is about west-central Texas, not Qatar, and doesn't mention TSE. |
| Injection could damage aquifer integrity | An expert interview | Opinion, not a measured finding. |

**Useful points from the report**
- Experts report "persistent monitoring gaps in some wells", which affect reported data.
- It recommends better data collection, transparency and a public database.
- Brackish groundwater desalination is increasingly needed before farm use.
- Injecting polluted oil and gas process water into deep aquifers is named as a further risk.
- Fresh groundwater is banned from farm use without a license (Art. 20.2, according to the report).
- Compliance with the law was [extended by six months](https://thepeninsulaqatar.com/article/23/06/2026/six-month-extension-granted-for-compliance-with-water-law-no-23) from 19 June 2026.

## National Planning Council coverage

- **Portal:** NPC has 1,538 datasets on the Qatar Open Data Portal. I searched all their titles and kept the water, climate, farm, crop, population and SDG ones. Each is listed in [sources.csv](sources.csv).
- **Water reports:** [Water Statistics 2023](https://www.npc.qa/en/statistics/Statistical%20Releases/Environmental/Water/Water_Statistics_2023_EN.pdf) is the newest I found. Reports named for 2022 and 2024 didn't exist at the expected addresses, but newer ones could sit elsewhere.
- **Website limit:** NPC's subject pages load through scripts, so I couldn't list every report on them.
- **Not groundwater quality:** no NPC dataset gives well-level groundwater quality.
- **Method change in 2023:** outflow to the sea goes from 18 to 195 million m³, and abstraction changes, because of Kahramaa's modeling project. Don't compare 2023 directly with earlier years.
- **Wording to watch:** the report's text says 2023 abstraction was "about 180", but that's farm wells. Its own chart adds 20 for other uses.

## Crop water and aquifers

From [Higazy et al. 2024](https://doi.org/10.3390/w16081185), open access under CC BY:

- **Crop table:** water footprints per ton are in [crop-water-footprints.csv](crop-water-footprints.csv). Dates are highest at 955 m³/ton, and greenhouse cucumber is lowest of the fruit and vegetables at 21.
- **Growing systems:** open field systems account for over 90% of the crop footprint.
- **Aquifers:** Rus and Umm er Radhuma. Basins shown are Northern, Doha, Southern and Allat, which are useful labels for stations.
- **Don't confuse:** its 50 million m³ agricultural footprint is estimated crop water use for selected crops, not abstraction. Its fodder value of 2 m³/ton also looks very low, so use it with caution.

## UDST groundwater research

Background only. We cite the paper and make no partnership claim.

| Item | Detail | Source |
|---|---|---|
| Title | Real-time AI-driven Groundwater Resilience Dashboard: A Tailored Climate Change Adaptative Solution for Qatar and beyond | [UDST](https://www.udst.edu.qa/center-excellence-sustainability-and-food-security) |
| Grant | CCEC 01-1108-230167, QRDI National Research Program: Climate Change and Environment | [Paper](https://doi.org/10.1007/s12665-026-13023-y) |
| Lead | Prof. Rachid Benlamri | [UDST](https://www.udst.edu.qa/center-excellence-sustainability-and-food-security) |
| Paper to cite | More, Rangarajan, Esmaeili, Gouissem & Benlamri (2026), Environmental Earth Sciences 85:288. Open access, CC BY. | [DOI](https://doi.org/10.1007/s12665-026-13023-y) |

- Three authors are on the committee: Dr Gouissem, Dr Rangarajan and Dr Esmaeili (spelled Esmaili in the deck).
- The paper recommends sensors for groundwater level, EC, TDS, pH and temperature, with anomaly detection and early warnings.
- It says its IoT framework is "a potential monitoring approach rather than an operational deployment in Qatar".
- It says data is "fragmented across agencies", and that black-box models weaken trust in AI-based decisions.
- [Qatar_MWDVF](https://github.com/Kagiso-S-More/Qatar_MWDVF), by the first author, holds 201 sampling locations from 2020. It has no open licence, and its link to the grant is my inference. It is downloaded to [Qatar_MWDVF/](Qatar_MWDVF/SOURCE.txt), and how to use it in the demo is still to be decided. Its TDS is exactly half its EC in all rows.
- I found no public dashboard for the project.

## Hardware to check

| Check | Why it matters |
|---|---|
| Read the model number on every board and probe | Everything below depends on it |
| Count the probes | The workshop slide reportedly says six sensors, but it shows five types |
| Measure each analog output with a multimeter before connecting it | ESP32 pins are 3.3 V, and some of these modules output more |
| Find the robot's software version | It decides which code you write |

### Sensors

| Sensor type | Likely model | Supply | Output | Range and accuracy | Source |
|---|---|---|---|---|---|
| TDS | DFRobot SEN0244 | 3.3-5.5 V | 0-2.3 V | 0-1000 ppm, 10% of full scale at 25 C | [HW-01](https://wiki.dfrobot.com/sen0244/) |
| pH | DFRobot SEN0161-V2 | 3.3-5.5 V | 0-3.0 V | pH 0-14, 0.1 at 25 C | [HW-02](https://wiki.dfrobot.com/Gravity__Analog_pH_Sensor_Meter_Kit_V2_SKU_SEN0161-V2) |
| Turbidity | DFRobot SEN0189 | 5 V | 0-4.5 V | No voltage-to-NTU formula given | [HW-03](https://wiki.dfrobot.com/Turbidity_sensor_SKU__SEN0189) |
| Temperature | DS18B20 waterproof | 3.0-5.5 V | Digital, 1-Wire | 0.5 C from -10 to 85 C | [HW-04](https://sparkfun.com/products/11050) |
| Water level | Contact or resistive strip | Check the board | Raw analog count | Not a depth until calibrated | [HW-08](https://zbotic.in/water-level-sensor-guide-tank-monitoring-with-arduino-and-esp32/) |

### What this means for the build

**1. The TDS probe may not reach groundwater salinity.** If yours is the SEN0244, it tops out at 1000 ppm ([HW-01](https://wiki.dfrobot.com/sen0244/)). The 205-well survey averaged 4,598 mg/L ([RS-01](https://www.pubmed.ncbi.nlm.nih.gov/38629132/)). Your "salty" sample may also exceed it. When a reading reaches the top of the range, send the `out_of_range` flag and don't present it as the true value. Be ready to explain this to reviewers: the live station shows the pipeline works, and the simulated stations show realistic groundwater.

**2. A turbidity module can damage the ESP32.** A 0-4.5 V output is above 3.3 V ([HW-03](https://wiki.dfrobot.com/Turbidity_sensor_SKU__SEN0189)). If yours matches, use a voltage divider before connecting it. Keep the result below about 3.1 V, the limit suggested in an [ESP32 forum reply](https://esp32.com/viewtopic.php?p=24314).

**3. TDS needs temperature.** The probe has no temperature sensor and assumes 25 C unless you add one ([HW-01](https://wiki.dfrobot.com/sen0244/)). Use your temperature reading in the calculation.

**4. Use ADC1 pins only.** ADC2 doesn't work while Wi-Fi is running ([HW-05](https://docs.espressif.com/projects/esp-idf/en/v3.2.3/api-reference/peripherals/adc.html)). The same docs say chips vary and readings are noisy. They suggest averaging several samples, a 0.1 uF capacitor on the input, and staying around 150-2450 mV at 11 dB. Those docs are older, so confirm the range in the current version.

**5. Calibrate pH with two buffers.** Use pH 7 and pH 4 solutions, and allow up to 2 minutes for a reading to settle ([HW-02](https://wiki.dfrobot.com/Gravity__Analog_pH_Sensor_Meter_Kit_V2_SKU_SEN0161-V2)). If you have the older V1 sensor, a forum reply says it needs 5 V ([HW-06](https://www.dfrobot.com/forum/topic/315951)).

**6. Treat water level as a relative value.** Record readings at known depths with a ruler and build a lookup table. Power the strip only while reading to slow corrosion ([HW-08](https://zbotic.in/water-level-sensor-guide-tank-monitoring-with-arduino-and-esp32/)). This source is a low-authority tutorial, but the advice is easy to test.

### Robots

Find out which robot and version you'll use, because the code differs for each:

| Robot and software | How you program it | Source |
|---|---|---|
| Older NAOqi | Python 2.7: `ALProxy("ALTextToSpeech", robot_ip, 9559)` | [RB-01](https://fileadmin.cs.lth.se/robot/nao/doc/naoqi/audio/altexttospeech-api.html) |
| NAOqi 2.8 | `session.service("ALTextToSpeech")` from the `qi` package | [RB-03](https://doc.nao6.maxtronics.com/naoqi/audio/altexttospeech-api.html) |
| Pepper 1.6 or 1.7 | NAOqi 2.5, Python only | [RB-04](https://support.unitedrobotics.group/en/support/solutions/articles/80001045565) |
| Pepper 1.8A or 1.8 | NAOqi 2.5 Python, or 2.9 Android (QiSDK) | [RB-04](https://support.unitedrobotics.group/en/support/solutions/articles/80001045565) |

- **Speech and gesture together:** `ALAnimatedSpeech` speaks with body language, which could cover both requirements in one call ([RB-02](https://fileadmin.cs.lth.se/robot/nao/doc/naoqi/audio/alanimatedspeech.html)).
- **Biggest risk:** a NAO user reported that Python 2.7 HTTPS failed against an Azure endpoint requiring TLS 1.2, while the same code worked on a PC ([RB-07](https://kaweah.freedombox.rocks/kiwix/stackoverflow.com_en_all_2023-11/questions/53226231/https-request-from-nao-in-python-dont-work)). A test call from the robot to the backend would settle this.
- **Possible fix on older robots:** one guide installs older `requests` and `urllib3` versions as root ([RB-08](https://ithelp.ithome.com.tw/articles/10229337)). It was written for a NAO V5, so it may not apply to your unit.

## Review of Deema's architecture diagram

All five required stages are there, in the right order, and the suitability engine is correctly separate from the agent. These are my recommendations for us to decide on.

**Bigger changes**

| Where | Now | Change to | Why |
|---|---|---|---|
| Subtitle | Geospatial Water Intelligence & Resource Allocation Platform | Groundwater Intelligence & Decision Support for Qatar | Matches your agreed focus, and avoids overclaiming to Kahramaa |
| Suitability engine | suitable / conditional / not recommended | Add **insufficient data** | It's your main trust feature |
| Suitability engine | irrigation, cooling, industrial | irrigation, landscaping, non-potable | Matches the profiles so far. No cooling or industrial criteria were found. |
| Web application | Municipal Dashboard | Role workspaces: Kahramaa, Municipality, MECC | This is your core idea, and it's missing from the picture |
| Stage 1 | Sensors are the only input | Add simulated stations through the same API, and official statistics as national context | Otherwise the diagram hides where most demo data comes from |
| Between stages 4 and 5 | Website and robot connect straight to the analysis | Add one "AquaMaa API" box | Both must use the same backend, and the robot must fetch live data from it |
| Whole diagram | No labels on data | Add provenance: measured, lab, research, synthetic | It's a key part of your evidence-graded promise |

**Smaller changes**

| Where | Now | Change to |
|---|---|---|
| Wi-Fi | HTTPS / MQTT | HTTPS only, which is what the contract uses |
| Buffering | Shown in the cloud stage | Move to the ESP32, where it happens |
| Robotics | ROS / SDK | NAOqi SDK, once you've confirmed the robot |
| Mapping | Mapbox / Leaflet | Leaflet only, showing simple labeled points |
| AI / RAG | LLM + vector search | LLM + tools + short document set, unless you bring vector search back |
| Water sources | Groundwater | Bench samples (live) and groundwater scenarios (simulated) |

The diagram shows Supabase, FastAPI and Next.js, which nobody has confirmed. Supabase free projects may pause when idle, so test that for your unattended week.

## Downloaded datasets

From the Qatar Open Data portal, licensed CC BY. They give national context only and contain no well-level quality data. Each CSV also has source columns.

| File | Source | Rows | Updated | What it gives you |
|---|---|---|---|---|
| [Total Abstraction from Ground Water](datasets/total-abstraction-from-ground-water.csv) | [KAHRAMAA](https://www.data.gov.qa/explore/dataset/total-abstraction-from-ground-water/) | 6 | 2026-06-20 | Official headline: 250 in 2019-2022, then 200 in 2023 and 2024 (Mm3). |
| [Total Water Storage](datasets/total-water-storage-2023.csv) | [KAHRAMAA](https://www.data.gov.qa/explore/dataset/total-water-storage-2023/) | 2 | 2026-06-20 | Misleading title. It holds abstraction by well type: 180 agricultural and 20 municipal in 2023 and 2024. |
| [Natural water balance of Qatar’s aquifers (Annual average 2014-2021)](datasets/natural-water-balance-of-qatar-s-aquifers-annual-average-2014-2021.csv) | [National Planning Council](https://www.data.gov.qa/explore/dataset/natural-water-balance-of-qatar-s-aquifers-annual-average-2014-2021/) | 10 | 2026-04-28 | Recharge from rain, inflow and outflow. Year labels are 2015-2021. |
| [Water Production, Abstraction, Losses and Uses](datasets/water-production-abstraction-losses-and-uses.csv) | [National Planning Council](https://www.data.gov.qa/explore/dataset/water-production-abstraction-losses-and-uses/) | 185 | 2026-07-24 | Best national time series, 2009-2023. Abstraction, reuse, losses. |
| [Details of water use balance (water balance, million m3)](datasets/details-of-water-use-balance-water-balance-million-m3.csv) | [National Planning Council](https://www.data.gov.qa/explore/dataset/details-of-water-use-balance-water-balance-million-m3/) | 60 | 2025-05-20 | Detailed national balance. |
| [Aggregate Water Use Balance (million m3)](datasets/aggregate-water-use-balance-million-m3.csv) | [National Planning Council](https://www.data.gov.qa/explore/dataset/aggregate-water-use-balance-million-m3/) | 16 | 2025-05-19 | Includes water injected into aquifers. |
| [Wastewater Treatment and Reuse Statistics by Year](datasets/wastewater-treatment-and-reuse-statistics-by-year.csv) | [National Planning Council](https://www.data.gov.qa/explore/dataset/wastewater-treatment-and-reuse-statistics-by-year/) | 14 | 2025-06-03 | Injection and reuse. Warning: 2020 and 2021 mix units in some rows. |
| [Number of Farms and Wells by Farm Status and Number of Wells Class](datasets/number-of-farms-and-wells-by-farm-status-and-number-of-wells-class.csv) | [Ministry of Municipality](https://www.data.gov.qa/explore/dataset/number-of-farms-and-wells-by-farm-status-and-number-of-wells-class/) | 294 | 2026-10-21 | Farms and wells by class, 2016-2023. Good for the Municipality view. |
| [Water Pollution Indicators](datasets/water-pollution-indicators.csv) | [Ministry of Environment and Climate Change](https://www.data.gov.qa/explore/dataset/water-pollution-indicators/) | 32 | 2026-09-29 | Marine water, not groundwater. Do not use as groundwater quality. |
| [Potable Water Production Capacities from Wells and Reverse Osmosis (RO)](datasets/potable-water-production-capacities-from-wells-and-reverse-osmosis-ro.csv) | [KAHRAMAA](https://www.data.gov.qa/explore/dataset/potable-water-production-capacities-from-wells-and-reverse-osmosis-ro/) | 18 | 2026-06-26 | Kahramaa well fields and RO plants, with well counts and output. |
| [Rainfall average (mm) at selected monitoring stations in Qatar](datasets/rainfall-average-mm-at-selected-monitoring-stations-in-qatar.csv) | [National Planning Council](https://www.data.gov.qa/explore/dataset/rainfall-average-mm-at-selected-monitoring-stations-in-qatar/) | 5 | 2025-05-29 | Rainfall at five stations, 2016-2021. |
| [Water used in agricultural activity by water source and agricultural GDP (at constant prices of 2018)](datasets/water-used-in-agricultural-activity-by-water-source-and-agricultural-gdp-at-constant-prices-of-2018.csv) | [National Planning Council](https://www.data.gov.qa/explore/dataset/water-used-in-agricultural-activity-by-water-source-and-agricultural-gdp-at-constant-prices-of-2018/) | 32 | 2025-05-19 | Farm water by source, 2014-2021. |
| [Non-Potable Water Used in District Cooling](datasets/non-potable-water-used-in-district-cooling.csv) | [KAHRAMAA](https://www.data.gov.qa/explore/dataset/non-potable-water-used-in-district-cooling/) | 6 | 2026-06-20 | Cooling water, 2019-2024. Supports the optional cooling persona. |
| [SDG 6.4.2 Level of Water Stress: Freshwater Withdrawal as a Proportion of Available Freshwater Resources by Economic Activity](datasets/sdg-6-4-2-level-of-water-stress-freshwater-withdrawal-as-a-proportion-of-available-freshwater.csv) | [National Planning Council](https://www.data.gov.qa/explore/dataset/sdg-6-4-2-level-of-water-stress-freshwater-withdrawal-as-a-proportion-of-available-freshwater/) | 72 | 2026-08-20 | Water stress by sector. |
| [SDG 6.5.1 Degree of Implementation of Integrated Water Resources Management by Sub Indicator](datasets/sdg-6-5-1-degree-of-implementation-of-integrated-water-resources-management-by-sub-indicator.csv) | [National Planning Council](https://www.data.gov.qa/explore/dataset/sdg-6-5-1-degree-of-implementation-of-integrated-water-resources-management-by-sub-indicator/) | 30 | 2026-10-13 | Water management maturity scores. |
| [Biological Water Quality Compliance by Year](datasets/biological-water-quality-compliance-by-year.csv) | [KAHRAMAA](https://www.data.gov.qa/explore/dataset/biological-water-quality-compliance-by-year/) | 6 | 2026-08-24 | Drinking network compliance, about 99%. |
| [Quality of coastal waters in Qatar by location](datasets/quality-of-coastal-waters-in-qatar-by-location.csv) | [National Planning Council](https://www.data.gov.qa/explore/dataset/quality-of-coastal-waters-in-qatar-by-location/) | 231 | 2026-07-24 | Coastal water, useful for an MECC view. Not groundwater. |
