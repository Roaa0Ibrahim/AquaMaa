package com.example.pepperwater

import com.aldebaran.qi.sdk.QiContext
import com.aldebaran.qi.sdk.builder.SayBuilder
import com.aldebaran.qi.sdk.`object`.conversation.BaseQiChatExecutor
import com.aldebaran.qi.sdk.`object`.locale.Locale

/**
 * Runs when a rule in water_quality.top calls ^execute(ask, <question>). By then Pepper has already said the rule's
 * filler line ("Let me check the sensor."), so there is no silence while the AI works. Pepper then says the answer;
 * QiSDK adds natural gestures while it speaks.
 */
class AskExecutor(
    private val ctx: QiContext,
    private val locale: Locale,
    private val status: (String) -> Unit,
    private val setAnswer: (String) -> Unit,
) : BaseQiChatExecutor(ctx) {

    override fun runWith(params: List<String>) {
        val question = params.joinToString(" ").trim()
        status("Asking AquaMaa (${AgentClient.mode}): $question")
        val answer = try {
            // One word = a topic (keyword file); a sentence = an exact question (the fallback file)
            // "now:temperature" = a live reading said at once, built by code on the laptop (no AI, under a second)
            (if (question.startsWith("now:")) AgentClient.now(question.removePrefix("now:"))
             else if (' ' in question) AgentClient.ask(question) else AgentClient.askTopic(question))
                .ifBlank { fallback(question) }
        } catch (e: Exception) {
            // The laptop can't be reached: say a fixed answer rather than nothing (15 Nov, demo safety net)
            status("Agent error: ${e.message} (fixed answer said)")
            fallback(question)
        }
        status("Answer: $answer")
        // The conversation itself says the answer: the rule continues with "$answer" after ^execute (15 Nov: a
        // separate Say inside the conversation was silent on the robot; the answer only showed as text)
        setAnswer(answer)
    }

    /** What Pepper says when the laptop can't answer: general, true without a live reading. */
    private fun fallback(question: String): String = when {
        question.contains("temperature") ->
            "The normal range for well water temperature is 15 to 35 degrees Celsius. I can't read the live sensor right now."
        question.contains("ph") ->
            "A healthy pH for well water is between 6.5 and 8.5. Outside that range, the water and the sensor should be checked. I can't read the live sensor right now."
        question.contains("salinity") || question.contains("drink") ->
            "Above 1000 parts per million, water is too salty to drink without treatment, but date palms, barley and wheat can still use it. I can't read the live sensor right now."
        question.contains("crops") ->
            "Salty water suits tolerant crops like date palms, barley and wheat; tomatoes, cucumbers and lettuce lose part of their harvest. I can't read the live sensor right now."
        else -> "I can't reach the sensor data right now. Please try again in a moment."
    }

    override fun stop() {}
}
