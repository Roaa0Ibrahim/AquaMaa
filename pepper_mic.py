"""Talk to Pepper through the laptop's microphone (16 Nov).

Pepper's own recognizer only hears a fixed list of English keywords. This page lets anyone ask in any wording:
the laptop's browser turns speech into text (Edge/Chrome speech recognition, English or Arabic), AquaMaa answers
with the live sensor data, and the answer is put in the alert messages that Pepper already reads every 3 s
(GET /alerts), so Pepper says it. No new Pepper app is needed.
Pepper's voice is English only: Arabic answers are spoken by the laptop in the natural Qatari voice (POST /speak).

Open on the laptop:  http://127.0.0.1:8000/mic
"""

PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ask Pepper</title>
<style>
:root{--ink:#0b2a4a;--muted:#5d7589;--line:#dfeef4;--teal:#12bfb7;--blue:#2f80ed;--bg:#f7fbfd}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Segoe UI",Arial,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 16px}
h1{margin:0 0 4px;font-size:30px}p.sub{margin:0 0 24px;color:var(--muted)}
.row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.seg button{border:2px solid var(--line);background:#fff;color:var(--ink);padding:8px 16px;border-radius:999px;
 font-size:15px;cursor:pointer}.seg button.on{border-color:var(--blue);background:#e0edfb;font-weight:700}
#mic{display:block;width:180px;height:180px;margin:18px auto;border-radius:50%;border:none;cursor:pointer;
 background:var(--teal);color:#fff;font-size:20px;font-weight:700;box-shadow:0 8px 24px rgba(10,80,105,.2)}
#mic.listen{background:#dc2626;animation:p 1s infinite}@keyframes p{50%{transform:scale(1.05)}}
#mic:disabled{background:#94a3b8;cursor:wait}
form{display:flex;gap:8px}input{flex:1;padding:12px;border:2px solid var(--line);border-radius:12px;font-size:16px}
form button{padding:12px 18px;border:none;border-radius:12px;background:var(--blue);color:#fff;font-size:16px;cursor:pointer}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-top:18px}
.label{font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
#status{text-align:center;color:var(--muted);min-height:22px}
[dir=rtl]{text-align:right}
</style></head><body><main>
<h1>Ask Pepper</h1>
<p class="sub">Speak into the laptop. AquaMaa answers from the live sensor data, and Pepper says the answer.</p>
<div class="row">
 <div class="seg" id="lang"><button data-v="en-US" class="on">English</button><button data-v="ar-QA">العربية</button></div>
 <div class="seg" id="role"><button data-v="officer" class="on">Officer</button><button data-v="farmer">Farmer</button></div>
</div>
<button id="mic">Hold to talk</button>
<div id="status">Press and hold, ask, then let go.</div>
<form id="typed"><input id="q" placeholder="Or type a question"><button>Ask</button></form>
<div class="card" id="qcard" hidden><div class="label">Question</div><div id="qtext"></div></div>
<div class="card" id="acard" hidden><div class="label" id="who">Answer</div><div id="atext"></div></div>
</main>
<script>
let lang = "en-US", role = "officer", heard = "", rec = null;
document.querySelectorAll(".seg").forEach(seg => seg.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  seg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
  if (seg.id === "lang") lang = b.dataset.v; else role = b.dataset.v;
}));
const status = t => document.getElementById("status").textContent = t;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const mic = document.getElementById("mic");
if (!SR) { mic.disabled = true; mic.textContent = "No mic"; status("This browser has no speech recognition: use Edge or Chrome, or type."); }
function start() {
  if (!SR || rec) return;
  heard = ""; rec = new SR(); rec.lang = lang; rec.interimResults = true; rec.continuous = true;
  rec.onresult = e => { heard = Array.from(e.results).map(r => r[0].transcript).join(" "); status("“" + heard + "”"); };
  rec.onerror = e => status("Microphone: " + e.error);
  rec.onend = () => { mic.classList.remove("listen"); mic.textContent = "Hold to talk"; rec = null; if (heard.trim()) send(heard.trim()); };
  rec.start(); mic.classList.add("listen"); mic.textContent = "Listening…"; status("Listening…");
}
function stop() { if (rec) rec.stop(); }
mic.addEventListener("mousedown", start); mic.addEventListener("mouseup", stop); mic.addEventListener("mouseleave", stop);
mic.addEventListener("touchstart", e => { e.preventDefault(); start(); }); mic.addEventListener("touchend", stop);
document.addEventListener("keydown", e => { if (e.code === "Space" && document.activeElement.id !== "q" && !e.repeat) { e.preventDefault(); start(); } });
document.addEventListener("keyup", e => { if (e.code === "Space" && document.activeElement.id !== "q") stop(); });
document.getElementById("typed").addEventListener("submit", e => { e.preventDefault(); const v = q.value.trim(); if (v) { q.value = ""; send(v); } });
async function send(question) {
  const ar = /[\\u0600-\\u06FF]/.test(question);
  qcard.hidden = false; qtext.textContent = question; qtext.dir = ar ? "rtl" : "ltr";
  acard.hidden = true; mic.disabled = true; status("AquaMaa is thinking…");
  try {
    const r = await fetch("/pepper/voice", {method: "POST", headers: {"Content-Type": "application/json"},
                                            body: JSON.stringify({question, role})});
    const d = await r.json(); if (!r.ok) throw new Error(d.detail || r.status);
    acard.hidden = false; atext.textContent = d.answer; atext.dir = ar ? "rtl" : "ltr";
    who.textContent = d.spoken_by === "pepper" ? "Pepper is saying" : "Answer (spoken by the laptop)";
    status(d.spoken_by === "pepper" ? "Sent to Pepper (it speaks within about 3 seconds)." : "");
    if (d.spoken_by === "laptop") {
      const s = await fetch("/speak", {method: "POST", headers: {"Content-Type": "application/json"},
                                       body: JSON.stringify({text: d.speak, lang: "ar"})});
      if (s.ok) new Audio(URL.createObjectURL(await s.blob())).play();
    }
  } catch (err) { status("Could not answer: " + err.message); }
  mic.disabled = !SR;
}
</script></body></html>"""
