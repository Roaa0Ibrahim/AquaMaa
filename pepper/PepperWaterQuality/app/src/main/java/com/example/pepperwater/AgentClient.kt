package com.example.pepperwater

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Talks to the AquaMaa agent service (python api.py on the laptop, on the same Wi-Fi as Pepper).
 *   ask(question)  -> the AI's answer, as an officer in the ministry, using the live sensor data
 *   alerts(after)  -> new spoken alerts since the last one Pepper said
 * Network calls must run off the UI thread (the robot callbacks and the alert thread already are).
 */
object AgentClient {
    var baseUrl = "http://192.168.8.100:8000"    // set from res/values/strings.xml (agent_url) at start

    private fun request(method: String, path: String, body: String?, readTimeoutMs: Int): String {
        val conn = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 5000
        conn.readTimeout = readTimeoutMs
        if (body != null) {
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        }
        try {
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            if (code !in 200..299) throw RuntimeException("Agent answered $code: ${text.take(200)}")
            return text
        } finally {
            conn.disconnect()
        }
    }

    /** The AI's answer to a question, cleaned up for speech. Throws if the agent can't be reached. */
    fun ask(question: String): String {
        val body = JSONObject()
            .put("question", question)
            .put("role", "officer")      // Pepper stands in the ministry's monitoring room
            .put("live", true)           // the agent fetches the dashboard's live readings itself
            .toString()
        val answer = JSONObject(request("POST", "/ask", body, 120000)).optString("answer", "")
        return speakable(answer)
    }

    /** New alert messages after sequence number `after`, and the latest sequence number. */
    fun alerts(after: Int): Pair<List<Pair<Int, String>>, Int> {
        val json = JSONObject(request("GET", "/alerts?after=$after", null, 5000))
        val list = json.optJSONArray("messages")
        val messages = mutableListOf<Pair<Int, String>>()
        if (list != null) {
            for (i in 0 until list.length()) {
                val m = list.getJSONObject(i)
                messages.add(Pair(m.getInt("seq"), speakable(m.optString("text", ""))))
            }
        }
        return Pair(messages, json.optInt("last", after))
    }

    /** Text as Pepper should say it: no source tags or notes, units in words. */
    fun speakable(text: String): String =
        text.substringBefore("\n\nKey figures:")
            .substringBefore("\n\nNote on sources:")
            .replace(Regex("\\[[^\\]]*\\]"), "")
            .replace("mg/L", " milligrams per litre")
            .replace("ppm", " parts per million")
            .replace("°C", " degrees")
            .replace(Regex("\\s+"), " ")
            .trim()
}
