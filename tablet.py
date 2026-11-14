"""A simple live sensor page for Pepper's tablet (14 Nov), served by api.py at /tablet, data at /live.

Pepper's tablet runs Android 6, whose built-in browser may be too old for Deema's dashboard (it uses newer JavaScript
such as ??). The Pepper app shows her dashboard first and falls back to this page if it doesn't appear.
Same data as the dashboard (Deema's server, read every few seconds by the alert watcher); old-style JavaScript (ES5)
that any browser runs; refreshes every 3 seconds.
"""


def live_summary(grounding, alerts):
    """The few numbers the tablet shows, from the dashboard's live data."""
    g = grounding or {}
    live = g.get("live") or {}
    metrics = live.get("metrics") or {}
    value = lambda k: (metrics.get(k) or {}).get("value")
    devices = live.get("devices") or []
    points = [p.get("median") for p in (((live.get("series") or {}).get("tds_ppm") or {}).get("points") or [])
              if isinstance(p.get("median"), (int, float))]
    ref = ((((g.get("thresholds") or {}).get("tds_ppm") or {}).get("reference")) or {}).get("max")
    return {"tds": value("tds"), "temperature": value("temperature"), "ph": value("ph"),
            "tdsLimit": ref, "status": (live.get("assessment") or {}).get("label"),
            "online": any(d.get("online") for d in devices), "devices": len(devices),
            "minutesAgo": min((d.get("minutesAgo") for d in devices if isinstance(d.get("minutesAgo"), (int, float))),
                              default=None),
            "period": g.get("dateRange"), "tdsSeries": points[-48:],
            "alert": alerts[-1]["text"] if alerts else None}


PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AquaMaa live</title>
<style>
 body{margin:0;background:#0B3D5C;color:#fff;font-family:sans-serif}
 .top{display:flex;justify-content:space-between;align-items:center;padding:14px 24px;background:#082c43}
 .top b{font-size:26px} .chip{padding:6px 14px;border-radius:16px;background:#2e7d32;font-size:18px}
 .chip.warn{background:#c62828} .chip.off{background:#616161}
 .row{display:flex;padding:16px 24px}
 .card{flex:1;margin-right:16px;background:#114d72;border-radius:12px;padding:14px 18px}
 .card:last-child{margin-right:0}
 .label{color:#CDEBFF;font-size:16px} .big{font-size:44px;font-weight:bold} .unit{font-size:18px;color:#CDEBFF}
 .chart{margin:0 24px;background:#114d72;border-radius:12px;padding:10px 18px}
 .alert{margin:14px 24px;padding:12px 18px;border-radius:12px;background:#c62828;font-size:20px;display:none}
 .foot{padding:6px 24px;color:#9fc3dc;font-size:14px}
</style></head><body>
<div class="top"><b>AquaMaa · live well sensor</b><span id="chip" class="chip off">connecting…</span></div>
<div class="row">
 <div class="card"><div class="label">Salinity (TDS)</div><div><span id="tds" class="big">–</span> <span class="unit">ppm</span></div><div id="tdsnote" class="label"></div></div>
 <div class="card"><div class="label">Temperature</div><div><span id="temp" class="big">–</span> <span class="unit">°C</span></div></div>
 <div class="card"><div class="label">pH</div><div><span id="ph" class="big">–</span></div></div>
</div>
<div class="chart"><div class="label">Salinity over <span id="period">the period</span></div><div id="spark"></div></div>
<div id="alert" class="alert"></div>
<div id="foot" class="foot"></div>
<script>
function el(id){return document.getElementById(id);}
function num(x,d){return (x===null||x===undefined)?'–':(Math.round(x*Math.pow(10,d))/Math.pow(10,d)).toString();}
function spark(pts,limit){
  if(!pts||pts.length<2){el('spark').innerHTML='<div class="label">Not enough readings yet</div>';return;}
  var w=700,h=110,lo=Math.min.apply(null,pts),hi=Math.max.apply(null,pts.concat(limit?[limit]:[]));
  if(hi===lo){hi=lo+1;}
  var d='';for(var i=0;i<pts.length;i++){var x=i*w/(pts.length-1),y=h-5-(pts[i]-lo)*(h-10)/(hi-lo);d+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);}
  var lim='';if(limit){var ly=h-5-(limit-lo)*(h-10)/(hi-lo);lim='<line x1="0" x2="'+w+'" y1="'+ly+'" y2="'+ly+'" stroke="#FFD54F" stroke-dasharray="6 6"/>';}
  el('spark').innerHTML='<svg width="100%" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+lim+'<path d="'+d+'" fill="none" stroke="#7fd3ff" stroke-width="3"/></svg>';
}
function show(s){
  el('tds').textContent=num(s.tds,0); el('temp').textContent=num(s.temperature,1); el('ph').textContent=num(s.ph,1);
  el('tdsnote').textContent=(s.tds!==null&&s.tdsLimit)?(s.tds>s.tdsLimit?'above the limit of '+s.tdsLimit:'within the limit of '+s.tdsLimit):'';
  el('period').textContent=s.period||'the period';
  var chip=el('chip');
  if(!s.online){chip.className='chip off';chip.textContent='sensor offline';}
  else{chip.className=(s.tdsLimit&&s.tds>s.tdsLimit)?'chip warn':'chip';chip.textContent=s.status||'online';}
  spark(s.tdsSeries,s.tdsLimit);
  var a=el('alert'); if(s.alert){a.style.display='block';a.textContent='⚠ '+s.alert;}else{a.style.display='none';}
  el('foot').textContent=s.devices+' sensor(s)'+(s.minutesAgo!==null?' · last reading '+s.minutesAgo+' min ago':'')+' · updated '+new Date().toLocaleTimeString();
}
function tick(){
  var x=new XMLHttpRequest(); x.open('GET','/live',true); x.timeout=5000;
  x.onload=function(){ if(x.status===200){ try{show(JSON.parse(x.responseText));}catch(e){} } };
  x.send();
}
tick(); setInterval(tick,3000);
</script></body></html>"""
