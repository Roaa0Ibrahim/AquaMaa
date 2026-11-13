# AquaNova team milestones

Built on the frozen idea in [AquaMaa.md](AquaMaa.md). Shareable pages: overview https://claude.ai/artifact/FGctg9H8xub7ZNuAnXYiAp · team plan https://claude.ai/artifact/XQfemAxsRasDkphYRpw2zi

Each person has their own track. A milestone is closed when its "Done when" check passes, then frozen as a version.
The sensors already send their readings to the shared database (Munira's link); every track reads from it.

**Part 1, due for the internal evaluation (Wednesday):** Roaa's Milestones 5-8 · Deema's Milestones 1-3 · Munira's Robot Milestones 1-2 · Mais's Knowledge Milestones 1-2.
**Part 2, future work if time allows:** Deema's Milestones 4-5 · Mais's Knowledge Milestone 3.

## Roaa: AI agent
Today's work: make the milestones already on the main list work, nothing new. Details in [AquaMaa.md](AquaMaa.md).
### [x] Milestones 1-4: model, knowledge base, routing, agent loop (v1-v4)
### [x] Milestone 5: Error-handling routing (v5, 13 Nov)
- **Done when:** each failure, forced on purpose, takes its route, and none produces an invented answer
- **Result:** 11 of 11 forced failures take their route, offline and live. Faithfulness before and after is carried to after the internal evaluation
### [ ] Milestone 6: Simplification prompting (in progress, branch `milestone-6`)
- **Done when:** the numbers match before and after, and 3 non-technical readers restate the main finding correctly
- **Built (13 Nov):** answers rewritten for a farm owner or manager, in English and Arabic, with few-shot examples; used only when Python finds the same numbers and sources. Research: `context/research/simplification-for-farmers.md`
- **First check:** 5 of 6 farmer questions simplified, each in the question's language. Still to do: the 3 non-technical readers
### [ ] Milestone 7: The website chat and Arabic text-to-speech (step 1, the text chat, done)
- **Done when:** a native Arabic speaker rates 10 spoken answers as clear, and it works with no robot
### [x] Milestone 8: Reading the dashboard (v8)

## Munira: sensors and robot
### [x] Sensors: readings reach the shared database
- Done: the sensors send their readings, and the database link is shared with the team
### [ ] Robot Milestone 1: Our Pepper runs our app
- Ala's starter app installed on the lab Pepper, following his guide (same Wi-Fi, ADB on to install, ADB off to run)
- **Done when:** Pepper greets and answers one starter question
### [ ] Robot Milestone 2: Pepper speaks the live reading
- Pepper reads the latest reading from the database and says it with its meaning and a gesture; Roaa helps with the code
- **Done when:** "What is the salinity now?" gets the value just measured, with a gesture, and a second question gets an answer

## Deema: website
### [ ] Milestone 1: The website reads the shared database (in progress)
- **Done when:** the website shows the latest sensor reading stored in the database
- **Status (13 Nov):** the dashboard is connected to Supabase and has its live sensor panels, but no reading shows yet: either the readings table has no read policy for the website (RLS), or the sensors sent nothing recently. Several pH columns: the values should be calculated in one place (the ESP32 or a database view), so the website, Pepper and the agent show the same numbers
### [ ] Milestone 2: Real data only
- Replace all dummy data with real data
- **Done when:** no dummy figure is left anywhere on the website
### [ ] Milestone 3: The main dashboard: live readings and the map
- The main dashboard shows the live sensor readings and the map, nothing else
- **Done when:** a new sensor reading appears on the main dashboard without refreshing the page
### [ ] Milestone 4 (future): Two accounts, officer and farmer
- **Done when:** signing in as an officer opens the main dashboard, and signing in as a farmer opens the farm page
### [ ] Milestone 5 (future): The farm page
- One example farm, with its wells and their information
- **Done when:** the farmer sees only their farm's wells, with each well's information

## Mais: knowledge and answers
### [ ] Knowledge Milestone 1: The questions we expect, and whether we can answer them
- What officers, farmers and visitors will ask, including what people say to Pepper
- For each question: do we have the right data, and where is it
- **Done when:** at least 30 questions are grouped by user, and each is marked with its source or as missing
### [ ] Knowledge Milestone 2: How we answer
- A draft of the simplification prompt (input to Milestone 6): plain words, numbers with their meaning, what to do next
- How answers are delivered: length, tone, spoken by Pepper or written on the website
- **Done when:** the draft prompt and 5 example questions with good answers are written, and Roaa has checked them
### [ ] Knowledge Milestone 3 (future): The knowledge files
- For each question marked missing, the source added as a text file to `database/`, with its title, publisher, link and licence
- **Done when:** every missing question has a source, or is marked as having no public source
