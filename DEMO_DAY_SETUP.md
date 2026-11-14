# Demo day: running the website and connecting Pepper

For Deema (and anyone setting up). About 10 minutes. Everything runs on **one laptop: Roaa's**, because:
- Pepper's app looks for AquaMaa (port 8000) and the dashboard (port 3000) **on the same laptop**
- the website's voice (speaking answers, Fanar speech-to-text) calls AquaMaa on the laptop the browser runs on
- the AI model runs on Roaa's laptop's graphics card

So the dashboard is hosted on Roaa's laptop, and Deema runs and checks it there.

## What you need
- Roaa's laptop, **plugged in** (on battery the AI is about 2x slower)
- Pepper's Wi-Fi (router 192.168.8.1; it can show as HUAWEI-89AB or HUAWEI-8983, same router)
- Munira's sensor (ESP32) switched on and sending
- Pepper switched on, with the AquaMaa app installed (latest zip: `AquaMaa_Pepper_for_Munira.zip`)

## Steps, in this order

**1. Wi-Fi.** Connect the laptop to Pepper's Wi-Fi. In Wi-Fi settings, untick "Connect automatically" for UDST so
the laptop doesn't jump back during the demo.

**2. Latest code.** In PowerShell, in the `fresh-start` folder:
```
git pull
git -C ..\aquamaa-dashboard pull
```
(`fresh-start` is on `milestone-6`, `aquamaa-dashboard` on `deema-development`.)

**3. The AI model.** Run `ollama ps`. If it errors, start the Ollama app from the Start menu.

**4. The dashboard (website).**
```
powershell -ExecutionPolicy Bypass -File scripts\restart_dashboard.ps1
```
It stops any old copy, installs packages, refreshes the demonstration data (the farmer's wells are kept) and starts
the website at http://localhost:3000. A new window opens for it: **leave it open**.
The Supabase settings are in `..\aquamaa-dashboard\.env` (already on this laptop; don't share them).

**5. AquaMaa (the AI) for Pepper and the website.** Open a second PowerShell window in `fresh-start`:
```
powershell -ExecutionPolicy Bypass -File scripts\start_for_pepper.ps1
```
It prints the laptop's address on Pepper's Wi-Fi (192.168.8.x) and starts AquaMaa. **Leave this window open.**
If Windows asks about the firewall for Python, click **Allow**.

**6. Check the website** (on the laptop, in **Microsoft Edge**: it has the natural Arabic voices):
- open http://localhost:3000 and sign in (accounts below)
- the four sensor cards show values and "Live · 5s" at the top; the time of the last reading is recent
- open the AquaMaa chat (bottom corner), ask "What is the salinity now?": an answer in about 5-10 s
- press the microphone, ask in Arabic: «كم الملوحة في البير الحين؟»: the answer is spoken

**7. Connect Pepper.**
- on Pepper's tablet: Settings -> Developer options -> **ADB OFF**; wait for "Connected to Pepper"
- open the **AquaMaa** app: it finds the laptop by itself ("Found AquaMaa at ...")
- the dashboard appears on the tablet: sign in once with the officer account
- the yellow text at the bottom right says **"Listening (keywords)..."**
- say "hello", then "what is the salinity now?"

## Accounts (password for both: `AquaMaa-Demo-2026`)
| Account | Email | Sees |
|---|---|---|
| Officer (Noura) | officer@aquamaa.demo | the monitoring dashboard, map, wells, alerts; used on Pepper |
| Farmer (Salem) | farmer@aquamaa.demo | My Farm: each well with its gauges and verdict for its crop (opens in Arabic) |

## If Deema changes the website
- page changes (`public/...`): commit, push to `deema-development`, then press **Ctrl+Shift+R** in the browser
- server changes (`server/...`, `config/thresholds.json`): commit, push, then run step 4 again
- on Pepper, close and reopen the AquaMaa app to load the new page

## If something goes wrong
| What you see | Fix |
|---|---|
| Website doesn't open at localhost:3000 | run step 4 again; read its window for the error |
| Chat answers "The AI model is not connected" | AquaMaa isn't running: step 5 |
| Answers take very long | laptop on battery, or Ollama not running (step 3) |
| Sensor cards say "Last known value" / sensor offline | Munira's ESP32 isn't sending: power and its Wi-Fi |
| Pepper's yellow text says "Starting..." | ADB is still on, or the tablet isn't "Connected to Pepper" yet |
| Pepper: "Looking for the AquaMaa laptop" for long | laptop not on Pepper's Wi-Fi, or step 5 not running |
| Pepper: "AquaMaa laptop not found" | tap the yellow text and type the address step 5 printed |
| Pepper hears you but doesn't answer | the sentence needs a keyword (salt, drink, palms, temperature, pH, alert, dashboard...); speak in English, 1 m away, after its eyes turn blue |

## Don't
- don't run two copies of AquaMaa or the dashboard (step 4 stops the old dashboard; close old AquaMaa windows)
- don't switch the laptop to another Wi-Fi during the demo
- don't close the two windows from steps 4 and 5
