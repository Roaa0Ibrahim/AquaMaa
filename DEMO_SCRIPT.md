# Demo script (draft, to edit)

13 minutes in total: slides about 8 min, demo 5 min (video 2:30 + live 2:00, with 30 s spare). Q&A 5 min after.
`[ ]` = a number to measure today and fill in. **Bold** = what happens on screen or on stage.

---

## Part 1: Slides (about 8 min)

### Slide 1: The problem (Roaa, 1:00)
**A photo of a farm well in the north, palms behind it.**

> In the north of Qatar, the sea is moving under the farms. The saline front advances about 4 to 5 kilometres
> a year. About 4,500 farm wells depend on this groundwater, and most of it is already brackish.
>
> Many wells already have sensors. They send a reading every day. But nobody reads them, so nobody acts on them.
> The farmer finds out the water turned salty when the palms turn brown, a season too late.
>
> Our target: when a well's salinity changes, the officer knows within 10 seconds, and the farmer
> knows what it means and what to do, in his own language.

### Slide 2: Our solution (Roaa, 1:00)
**Three columns: Today / The gap / AquaMaa.**

> Today, the readings exist. The gap is everything after the reading: what it means, who is told, and what to do.
>
> AquaMaa closes that gap with three things:
> one, a live dashboard with alerts for the ministry;
> two, Pepper in the monitoring room, which speaks up when a well goes wrong, and answers the officer's questions;
> three, an assistant for the farmer on the website, in Arabic or English, typed or spoken, even in Qatari dialect.
>
> Our idea in three words: **reading, meaning, action.**

### Slide 3: Architecture (one chain diagram; each owner speaks for their part, 3:00)
**The chain: probes → ESP32 → Wi-Fi → Supabase database → dashboard and alerts → AquaMaa AI → website and Pepper.**

**Munira (1:00): sensors and Pepper**
> We measure TDS for salinity, pH, temperature and turbidity. [How the sensors were calibrated, in one sentence.]
> The ESP32 sends every reading over Wi-Fi with no cable, so it can sit at the well, away from any laptop.
> Pepper runs our own Android app: it checks for new alerts every 3 seconds and speaks them, and it sends the
> officer's questions to our AI.

**Deema (0:45): database and dashboard**
> Every reading is saved with its time in the database, so we can show any past moment, like the sample change.
> The dashboard updates by itself within [ ] seconds, with units and a history chart.
> It checks each reading against reference ranges and raises alerts, including when a sensor stops sending.

**Roaa (0:45): the AI**
> The AI runs on our own laptop, with an open model, Qwen. Our rule: **facts by code, words by the model.**
> Python reads the live reading and our verified sources and decides the facts, like "too salty to drink, fine for
> date palms". The model only puts them into simple words. Then a check rejects any number or source that
> wasn't in the facts. So it can't invent a number.
> For Arabic dialect, we use Fanar, the Qatari Arabic model from QCRI, to understand questions like
> «شكثر الاملاح في بيري؟». And if speech recognition mishears a word, AquaMaa guesses the intended word from
> its own vocabulary, and tells the farmer how it understood the question.

**Mais (0:30): the knowledge**
> The answers come from verified sources: Qatar's farm census, Kahramaa and the planning council's statistics,
> water-quality limits from WHO and FAO, crop salt tolerance, and Qatar's water law. Each answer names its source.

### Slide 4: Results (Roaa, 1:15)
**A table: target vs measured.**

| What | Target | Measured |
|---|---|---|
| Dashboard update after a sample change | 5 s | [ ] s |
| Alert spoken by Pepper | 10 s | [ ] s |
| Answer time (common questions) | about 5 s | 4-7 s |
| Answer in the question's language | all | 21 of 21 test questions |
| Right source found | | 26 of 27 questions |
| Forced failures handled without an invented answer | all | 11 of 11 |

> We tested each part against its target. [One sentence on the sensor test: tap vs salty water readings.]

### Slide 5: Impact and conclusion (all, 1:00)
**Users · cost · scale · limits · next steps · who built what.**

> **Roaa:** For farmers, a reading becomes a decision. For the ministry, every well in one room, with a voice.
> **Munira:** The kit costs about [ ] riyals per well, and Wi-Fi or a SIM is enough to send the data.
> **Deema:** Our limits: one sensor kit, not a real farm well yet; turbidity is not calibrated; forecasting is next.
> **Mais:** Next: connect to the real well sensors, add more farms, and Arabic on Pepper.
> **Roaa:** Now let us show you.

---

## Part 2: Demo (5 min)

### The video (2:30). Voice-over by Roaa; the words on screen are short captions.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 | **Probes in a cup of tap water. The ESP32 on a battery, across the room. No cable.** Caption: *ESP32 · Wi-Fi · no USB* | "This is our well. Four sensors in the water, and an ESP32 sending each reading over Wi-Fi, away from any computer." |
| 0:15 | **The dashboard: TDS, pH, temperature with units; the history chart.** | "The dashboard shows the live readings and their history. Right now: tap water, low salinity." |
| 0:30 | **A hand pours salt into the cup. A timer starts on screen.** Caption: *tap → salty* | "Now the well turns salty." |
| 0:40 | **The TDS number climbs; the timer stops at [ ] s. The history chart shows the jump.** | "The dashboard updates by itself, in [ ] seconds." |
| 0:55 | **The alert banner appears on the dashboard. Cut to Pepper in the "monitoring room".** | "And nobody had to ask." |
| 1:00 | **Pepper raises its arm and speaks the alert.** (Pepper's own words: the value, what it means, the advice, the crops that still tolerate it) | (silence: let Pepper speak) |
| 1:25 | **Noura (a team member) turns to Pepper:** "Pepper, what is the salinity now?" **Pepper answers with the value and its meaning.** | |
| 1:45 | **Noura:** "Can farmers still use this water for date palms?" **Pepper answers.** | |
| 2:05 | **Cut to a phone: Salem, the farmer. He taps the microphone and says:** «شكثر الاملاح في بيري؟» **The answer appears and is read aloud in Arabic.** Caption: *Qatari dialect · voice · Arabic answer* | "And the farmer asks in his own words, in his own dialect." |
| 2:25 | **Logo + tagline.** | "AquaMaa. Reading, meaning, action." |

### Live (2:00). Munira at the sensors, Deema at the dashboard, Roaa at Pepper.

| Time | Who | Action and words |
|---|---|---|
| 0:00 | Roaa | "Now live. Munira will change the water." |
| 0:05 | Munira | **Pours salt into the cup.** "From tap water to salty water." |
| 0:10 | Deema | **Points at the dashboard.** "The reading updates, here, by itself. And the alert." |
| 0:25 | (Pepper) | **Speaks the alert with its gesture.** |
| 0:50 | Roaa | "You can ask Pepper yourself." **Invites a judge, or asks:** "Pepper, what is the salinity now?" |
| 1:15 | Mais | **On the website, by voice:** «أقدر أسقي النخل بهالماي؟» **The answer is read aloud.** |
| 1:45 | Roaa | "Every reading, its meaning, and what to do. Thank you." |

**If something fails live:** say it calmly ("the sensor lost Wi-Fi; you saw the same moment in the video") and move on.

---

## Before recording: checklist
- [ ] The sensor is online and has stayed online for 10 minutes, away from the laptop
- [ ] Salt measured in advance, so TDS clearly crosses the alert threshold; tap water clearly below it
- [ ] The laptop is charged and plugged in; `api.py` running; Ollama warm (ask one question first)
- [ ] Pepper is on the laptop's Wi-Fi; the app is running; alerts on; it said one test alert
- [ ] The 3 Pepper questions and the 2 Arabic voice questions tested once with the live sensor
- [ ] Timer on screen; screen recording for the dashboard; phone on a stand for Pepper
- [ ] Each speaker has read their lines aloud once and timed them
