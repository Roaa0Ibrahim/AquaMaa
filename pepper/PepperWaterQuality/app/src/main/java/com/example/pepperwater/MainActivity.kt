package com.example.pepperwater

import android.os.Bundle
import android.util.Log
import android.view.View
import com.aldebaran.qi.sdk.design.activity.conversationstatus.SpeechBarDisplayStrategy
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import com.aldebaran.qi.Future
import com.aldebaran.qi.sdk.QiContext
import com.aldebaran.qi.sdk.QiSDK
import com.aldebaran.qi.sdk.RobotLifecycleCallbacks
import com.aldebaran.qi.sdk.builder.ChatBuilder
import com.aldebaran.qi.sdk.builder.QiChatbotBuilder
import com.aldebaran.qi.sdk.builder.SayBuilder
import com.aldebaran.qi.sdk.builder.TopicBuilder
import com.aldebaran.qi.sdk.design.activity.RobotActivity
import com.aldebaran.qi.sdk.`object`.conversation.Chat
import com.aldebaran.qi.sdk.`object`.conversation.QiChatExecutor
import com.aldebaran.qi.sdk.`object`.locale.Language
import com.aldebaran.qi.sdk.`object`.locale.Locale
import com.aldebaran.qi.sdk.`object`.locale.Region

/**
 * AquaMaa on Pepper (NAOqi 2.9 / QiSDK), built on Ala's hello-world app. Pepper stands in the ministry's monitoring
 * room and does three things:
 *  1. Listens for the demo questions in res/raw/water_quality.top; each one says a filler line at once and then asks
 *     the AquaMaa agent on the laptop (AskExecutor), and Pepper speaks the answer.
 *  2. Speaks alerts without being asked: a background thread asks the agent for new alerts every 3 seconds
 *     (GET /alerts); for each one Pepper pauses listening, says it, and listens again.
 *  3. Shows on the tablet the live dashboard (dashboard_url), and below it what it heard and what it is saying.
 * The laptop's address is agent_url in res/values/strings.xml.
 */
class MainActivity : RobotActivity(), RobotLifecycleCallbacks {

    private var chat: Chat? = null
    private var chatFuture: Future<Void>? = null
    private var alertThread: Thread? = null
    @Volatile private var running = false
    private val speechLock = Object()
    private val english = Locale(Language.ENGLISH, Region.UNITED_STATES)
    private lateinit var statusView: TextView
    private lateinit var heardView: TextView
    private lateinit var answerView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Full height for the dashboard: no QiSDK speech bar at the top, no Android system bars (14 Nov)
        setSpeechBarDisplayStrategy(SpeechBarDisplayStrategy.IMMERSIVE)
        setContentView(R.layout.activity_main)
        hideSystemBars()
        statusView = findViewById(R.id.status)
        heardView = findViewById(R.id.heard)
        answerView = findViewById(R.id.answer)
        // The laptop's address: the last one that worked (saved on the tablet), else the one built in; checked at
        // start, and found again on the network if it doesn't answer. Tap the yellow line to type one by hand.
        val saved = getSharedPreferences("aquamaa", MODE_PRIVATE).getString("laptop_host", null)
        useLaptop(saved ?: android.net.Uri.parse(getString(R.string.agent_url)).host ?: "192.168.8.100", save = false)
        statusView.setOnClickListener { askForAddress() }
        // Officer / Farmer and EN / ع, remembered on the tablet (15 Nov)
        val prefs = getSharedPreferences("aquamaa", MODE_PRIVATE)
        AgentClient.mode = prefs.getString("mode", "officer") ?: "officer"
        pageLang = prefs.getString("lang", "en") ?: "en"
        findViewById<TextView>(R.id.mode_officer).setOnClickListener { signOut() }
        findViewById<TextView>(R.id.mode_farmer).setOnClickListener { signOut() }
        findViewById<TextView>(R.id.lang).setOnClickListener {
            pageLang = if (pageLang == "en") "ar" else "en"
            prefs.edit().putString("lang", pageLang).apply()
            showSwitches(); findViewById<WebView>(R.id.dashboard).loadUrl(dashboardUrl)
        }
        showSwitches()
        showDashboard()
        findLaptop()
        QiSDK.register(this, this)
    }

    @Volatile private var laptop = ""
    @Volatile private var searching = false
    @Volatile private var pageLang = "en"
    private val dashboardUrl get() = "http://$laptop:3000/"      // the website opens each account on its own home page

    /** Officer or Farmer: the page, the account it signs in with, and the role of Pepper's answers. */
    private fun setMode(m: String) {
        AgentClient.mode = m
        getSharedPreferences("aquamaa", MODE_PRIVATE).edit().putString("mode", m).apply()
        showSwitches()
        findViewById<WebView>(R.id.dashboard).loadUrl(dashboardUrl)
        status(if (m == "farmer") "Farmer mode: My Farm, answers for the farm owner" else "Officer mode: all wells, answers for the ministry")
    }

    private fun showSwitches() {
        val on = android.graphics.Color.parseColor("#12BFB7"); val off = android.graphics.Color.parseColor("#5D7589")
        findViewById<TextView>(R.id.mode_officer).setTextColor(if (AgentClient.mode == "officer") on else off)
        findViewById<TextView>(R.id.mode_farmer).setTextColor(if (AgentClient.mode == "farmer") on else off)
        findViewById<TextView>(R.id.lang).text = if (pageLang == "ar") "ع | EN" else "EN | ع"
    }

    /** The page's language, and who is signed in: Pepper's mode follows the account on the sign-in page (15 Nov:
     *  "keep the login page"). The page tells the app through AquaMaaApp.role(...). */
    private fun pageJs(): String = """(function(){try{
          var lang='$pageLang', changed=(localStorage.getItem('aq_lang')||'en')!==lang; localStorage.setItem('aq_lang',lang);
          if(changed){ location.reload(); return; }
          fetch('/api/auth/me',{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null;}).then(function(me){
            if(me&&me.user&&window.AquaMaaApp) AquaMaaApp.role(me.user.role||'');
          });
          window.addEventListener('hashchange',function(){ fetch('/api/auth/me',{credentials:'same-origin'})
            .then(function(r){return r.ok?r.json():null;}).then(function(me){ if(me&&me.user&&window.AquaMaaApp) AquaMaaApp.role(me.user.role||''); }); });
        }catch(e){}})()"""

    /** Tapping Officer or Farmer: sign out, back to the sign-in page, to switch account. */
    private fun signOut() {
        findViewById<WebView>(R.id.dashboard).evaluateJavascript(
            "fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'}).then(function(){location.hash='';location.reload();})", null)
        status("Signed out: sign in as the officer or the farmer")
    }

    inner class PageBridge {
        @android.webkit.JavascriptInterface
        fun role(r: String) {
            val m = if (r == "farmer") "farmer" else "officer"
            if (m != AgentClient.mode) runOnUiThread {
                AgentClient.mode = m
                getSharedPreferences("aquamaa", MODE_PRIVATE).edit().putString("mode", m).apply()
                showSwitches()
                status(if (m == "farmer") "Farmer signed in: answers about the farm" else "Officer signed in: answers about all wells")
            }
        }
    }

    private fun useLaptop(host: String, save: Boolean = true) {
        laptop = host.trim()
        AgentClient.baseUrl = "http://$laptop:8000"
        if (save) getSharedPreferences("aquamaa", MODE_PRIVATE).edit().putString("laptop_host", laptop).apply()
    }

    /** Checks the laptop's address; if AquaMaa doesn't answer there, looks for it on this Wi-Fi and reloads. */
    private fun findLaptop() {
        if (searching) return
        searching = true
        Thread {
            try {
                if (LaptopFinder.healthy(laptop)) return@Thread
                status("Looking for the AquaMaa laptop on this Wi-Fi…")
                val found = LaptopFinder.find()
                if (found != null) {
                    useLaptop(found)
                    status("Found AquaMaa at $found")
                    runOnUiThread { findViewById<WebView>(R.id.dashboard).loadUrl(dashboardUrl) }
                } else {
                    status("AquaMaa laptop not found on this Wi-Fi. Is it on HUAWEI-89AB? Tap here to type its address.")
                }
            } finally {
                searching = false
            }
        }.start()
    }

    /** Tap the yellow line: type the laptop's address by hand (the backup). */
    private fun askForAddress() {
        val input = android.widget.EditText(this)
        input.setText(laptop)
        android.app.AlertDialog.Builder(this)
            .setTitle("AquaMaa laptop address")
            .setMessage("The address scripts\\start_for_pepper.ps1 prints, such as 192.168.8.109")
            .setView(input)
            .setPositiveButton("Use") { _, _ ->
                useLaptop(input.text.toString())
                findViewById<WebView>(R.id.dashboard).loadUrl(dashboardUrl)
                status("Using AquaMaa at $laptop")
            }
            .setNeutralButton("Search again") { _, _ -> findLaptop() }
            .setNegativeButton("Cancel", null)
            .show()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    /** The live dashboard on the tablet. It stays signed in (cookies), and reloads if the laptop wasn't ready. */
    private fun showDashboard() {
        val web = findViewById<WebView>(R.id.dashboard)
        web.settings.javaScriptEnabled = true
        web.addJavascriptInterface(PageBridge(), "AquaMaaApp")   // the page tells the app who signed in
        web.settings.domStorageEnabled = true
        web.settings.useWideViewPort = true
        web.settings.loadWithOverviewMode = true
        web.setInitialScale(80)                  // the dashboard is laid out for a laptop: fit more of it on the tablet
        CookieManager.getInstance().setAcceptCookie(true)
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean = false   // stay in the app
            // On Pepper, people talk to Pepper itself; the website's chat box stays for typed questions, without its
            // microphone and language buttons (the microphone needs HTTPS, which the tablet doesn't have) (14 Nov)
            override fun onPageFinished(view: WebView, url: String) {
                view.evaluateJavascript("(function(){var s=document.createElement('style');" +
                    "s.textContent='#aq-root .aq-round.mic,#aq-root .aq-speech-lang{display:none!important}';" +
                    "document.head.appendChild(s);})()", null)
                view.evaluateJavascript(pageJs(), null)          // the page's language; Pepper follows who signed in
            }
            @Suppress("OverridingDeprecatedMember")
            override fun onReceivedError(view: WebView, code: Int, description: String?, failingUrl: String?) {
                status("Dashboard not reachable ($description); looking for the laptop again")
                findLaptop()                                  // the laptop's address may have changed
                view.postDelayed({ view.loadUrl(dashboardUrl) }, 10000)
            }
        }
        web.loadUrl(dashboardUrl)
        // Pepper's Android 6 browser may be too old for the dashboard's JavaScript: if neither the dashboard nor its
        // sign-in screen appeared after 12 s, show AquaMaa's simple live page instead (api.py /tablet)
        web.postDelayed({
            web.evaluateJavascript(
                "(function(){var v=document.getElementById('view'),l=document.getElementById('login');" +
                "return !!((v&&v.children.length)||(l&&!l.hidden));})()"
            ) { shown ->
                if (shown != "true") {
                    status("Dashboard didn't render on this tablet; showing AquaMaa's live page")
                    web.loadUrl(AgentClient.baseUrl.trimEnd('/') + "/tablet")
                }
            }
        }, 12000)
    }

    /** The caption bar: what Pepper is saying right now (answers and alerts), for the room to read. */
    private fun caption(text: String) {
        runOnUiThread { answerView.text = text }
    }

    override fun onDestroy() {
        QiSDK.unregister(this, this)
        super.onDestroy()
    }

    private fun status(text: String) {
        Log.i(TAG, text)
        try {
            val f = java.io.File(getExternalFilesDir(null), "pepper_log.txt")
            val time = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())
            f.appendText("$time  $text\n")
        } catch (e: Throwable) { }
        runOnUiThread { statusView.text = text }
        if (text.startsWith("Answer: ")) caption(text.removePrefix("Answer: "))
        if (text.startsWith("Alert: ")) caption("⚠ " + text.removePrefix("Alert: "))
    }

    private var mode = ""

    @Volatile private var drinkVar: com.aldebaran.qi.sdk.`object`.conversation.QiChatVariable? = null

    /** Every 5 s, the live "is the water drinkable" answer (readings + verdict) is put in $answer, so the rule says
     *  it at once when asked, with readings at most 5 s old (15 Nov: the filmed question must answer straight away). */
    private fun startDrinkRefresh() {
        Thread {
            while (running) {
                try {
                    val a = AgentClient.now("drink")
                    if (a.isNotBlank()) drinkVar?.value = a
                } catch (e: Exception) { /* keep the last answer */ }
                try { Thread.sleep(5000) } catch (e: InterruptedException) { break }
            }
        }.start()
    }

    private fun makeChat(qiContext: QiContext, topicRes: Int): Chat {
        val topic = TopicBuilder.with(qiContext).withResource(topicRes).build()
        val executors = HashMap<String, QiChatExecutor>()
        val chatbot = QiChatbotBuilder.with(qiContext).withTopic(topic).withLocale(english).build()
        val answerVar = chatbot.variable("answer")     // the rule says "$answer"
        // Never empty: a rule whose variable has no value is skipped and Pepper says nothing (15 Nov)
        answerVar.value = "Above 1000 parts per million, water is too salty to drink without treatment."
        drinkVar = answerVar
        executors["ask"] = AskExecutor(qiContext, english, { status(it) }) { answerVar.value = it }
        chatbot.executors = executors          // QiSDK 1.7.5: set after build (the builder has no withExecutors)
        return ChatBuilder.with(qiContext).withChatbot(chatbot).withLocale(english).build()
    }

    override fun onRobotFocusGained(qiContext: QiContext) {
        status("Robot connected. AquaMaa at ${AgentClient.baseUrl}")
        SayBuilder.with(qiContext)
            .withText("AquaMaa is ready.")
            .withLocale(english).build().run()
        try {
            // Keyword listening first (any sentence with a known word); the exact sentences if Pepper rejects it
            val c = try {
                makeChat(qiContext, R.raw.water_keywords).also { mode = "keywords" }
            } catch (e: Throwable) {
                status("Keyword listening unavailable (${e.message}); using exact sentences")
                makeChat(qiContext, R.raw.water_quality).also { mode = "exact sentences" }
            }
            c.addOnStartedListener { status("Listening ($mode)... ask me about the water") }
            c.addOnHeardListener { phrase -> runOnUiThread { heardView.text = "You asked: \"${phrase.text}\"" } }
            c.addOnNoPhraseRecognizedListener {
                runOnUiThread { heardView.text = "Heard something, but did not understand" }
            }
            chat = c
            startChat()
            startAlertLoop(qiContext)
            startDrinkRefresh()
        } catch (e: Throwable) {
            status("Chat setup error: ${e.message}")
            SayBuilder.with(qiContext).withText("Sorry, I could not load my questions.").withLocale(english).build().run()
        }
    }

    private fun startChat() {
        val c = chat ?: return
        chatFuture = c.async().run()
        chatFuture?.thenConsume { f ->
            if (f.hasError()) status("Chat error: " + (f.error?.message ?: "unknown error"))
        }
    }

    private fun stopChat() {
        val f = chatFuture ?: return
        f.requestCancellation()
        try { f.get() } catch (e: Throwable) { }   // wait until listening has really stopped
        chatFuture = null
    }

    /** Says an alert: pause listening, speak, listen again. One at a time. */
    private fun speakAlert(qiContext: QiContext, text: String) {
        synchronized(speechLock) {
            status("Alert: $text")
            stopChat()
            try {
                SayBuilder.with(qiContext).withText(text).withLocale(english).build().run()
            } catch (e: Throwable) {
                status("Could not say the alert: ${e.message}")
            }
            if (running) startChat()
        }
    }

    /** Every 3 seconds, asks the agent for new alerts. Alerts that existed before Pepper started are not said. */
    private fun startAlertLoop(qiContext: QiContext) {
        running = true
        alertThread = Thread {
            var last = -1
            var reported = false
            var lastSearch = 0L
            while (running) {
                try {
                    val (messages, newest) = AgentClient.alerts(if (last < 0) 0 else last)
                    if (last < 0) {
                        last = newest          // first check: remember where we are, say nothing
                    } else {
                        for ((seq, text) in messages) {
                            if (text.isNotBlank()) speakAlert(qiContext, text)
                            last = maxOf(last, seq)
                        }
                    }
                    reported = false
                } catch (e: Exception) {
                    if (!reported) status("Can't reach AquaMaa for alerts: ${e.message}")
                    // Look for the laptop again every 30 s while it can't be reached (15 Nov: it searched only once,
                    // so after the laptop changed Wi-Fi and came back, Pepper never found it again)
                    if (System.currentTimeMillis() - lastSearch > 30000) { lastSearch = System.currentTimeMillis(); findLaptop() }
                    reported = true
                }
                try { Thread.sleep(3000) } catch (e: InterruptedException) { break }
            }
        }
        alertThread?.start()
    }

    override fun onRobotFocusLost() {
        status("Robot focus lost")
        running = false
        alertThread?.interrupt()
        alertThread = null
        chatFuture?.requestCancellation()
        chatFuture = null
    }

    override fun onRobotFocusRefused(reason: String?) {
        status("Robot focus refused: $reason")
    }

    companion object {
        private const val TAG = "AquaMaaPepper"
    }
}
