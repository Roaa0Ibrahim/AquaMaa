package com.example.pepperwater

import android.os.Bundle
import android.util.Log
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
 *  3. Shows on the tablet what it heard and what it is doing, for debugging.
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        statusView = findViewById(R.id.status)
        heardView = findViewById(R.id.heard)
        AgentClient.baseUrl = getString(R.string.agent_url)
        QiSDK.register(this, this)
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
    }

    override fun onRobotFocusGained(qiContext: QiContext) {
        status("Robot connected. AquaMaa at ${AgentClient.baseUrl}")
        SayBuilder.with(qiContext)
            .withText("Hello! I am AquaMaa. I watch the wells, and I will tell you when the water changes.")
            .withLocale(english).build().run()
        try {
            val topic = TopicBuilder.with(qiContext).withResource(R.raw.water_quality).build()
            val executors = HashMap<String, QiChatExecutor>()
            executors["ask"] = AskExecutor(qiContext, english) { status(it) }
            val chatbot = QiChatbotBuilder.with(qiContext).withTopic(topic).withLocale(english)
                .withExecutors(executors).build()
            val c = ChatBuilder.with(qiContext).withChatbot(chatbot).withLocale(english).build()
            c.addOnStartedListener { status("Listening... ask me about the water") }
            c.addOnHeardListener { phrase -> runOnUiThread { heardView.text = "Heard: \"${phrase.text}\"" } }
            c.addOnNoPhraseRecognizedListener {
                runOnUiThread { heardView.text = "Heard something, but did not understand" }
            }
            chat = c
            startChat()
            startAlertLoop(qiContext)
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
