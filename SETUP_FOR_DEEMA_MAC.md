# Running AquaMaa on Deema's Mac (demo day)

Roaa's laptop won't be there, so the AI (AquaMaa) runs on Deema's Mac, next to the website she already runs.
Pepper's app finds the Mac on Pepper's Wi-Fi by itself: nothing to change on Pepper.

## Tonight (needs internet, about 30-60 minutes, mostly downloads)
1. **Install** if not there yet: Python 3.13 (https://www.python.org/downloads/) and Ollama (https://ollama.com/download).
   Open the Ollama app once.
2. **Get AquaMaa's code** next to the website's folder (same GitHub repository, branch `milestone-6`):
   ```
   cd <the folder that contains your website folder>
   git clone -b milestone-6 https://github.com/Roaa0Ibrahim/AquaMaa.git aquamaa-agent
   ```
3. **Copy the setup kit's files** (`AquaMaa_Mac_kit.zip` from Roaa) into `aquamaa-agent`:
   `vector_store.json`, `chunks.jsonl` and `.env` (the `.env` holds the Fanar key: keep it private, don't commit it).
4. **Run the one-time setup:**
   ```
   cd aquamaa-agent
   bash scripts/setup_mac.sh
   ```
   It installs AquaMaa's packages, picks the AI model size from the Mac's memory (16 GB -> qwen3:8b,
   32 GB or more -> qwen3:14b) and downloads the models. It ends with "Setup done".
5. **Update the website** to the latest `deema-development` (`git pull` in the website's folder).
6. **Test once:** `DASHBOARD_DIR=<your website folder> bash scripts/start_demo_mac.sh`
   -> it should end with READY and open the website; ask the chat "What is the salinity now?".

## Demo day
1. Mac **plugged in**, on **Pepper's Wi-Fi** (HUAWEI-89AB / HUAWEI-8983).
2. In Terminal:
   ```
   cd aquamaa-agent
   DASHBOARD_DIR=<your website folder> bash scripts/start_demo_mac.sh
   ```
   Wait for **READY** (1-2 minutes). If macOS asks to allow incoming connections for Python or Node: **Allow**
   (Pepper and phones connect to the Mac).
3. Pepper: tablet **ADB OFF**, wait for "Connected to Pepper", open the **AquaMaa** app. It finds the Mac by itself.
   Sign in once on the tablet: `officer@aquamaa.demo` / `AquaMaa-Demo-2026`.
4. After the demo: `bash scripts/stop_demo_mac.sh`

## Good to know
- The website's own `.env` (Supabase) is Deema's, as before.
- Speech in the website chat and the natural voice need internet; without it they fall back to the browser.
- Logs if something fails: `aquamaa-agent/logs/api_demo.log` (AquaMaa), `logs/dashboard_demo.log` (website).
- Questions for Pepper: `pepper/PEPPER_QUESTIONS.txt`.
- The full checklist and troubleshooting table: `DEMO_DAY_SETUP.md` (written for Windows, the same steps apply).
