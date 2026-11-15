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
) : BaseQiChatExecutor(ctx) {

    override fun runWith(params: List<String>) {
        val question = params.joinToString(" ").trim()
        status("Asking AquaMaa (${AgentClient.mode}): $question")
        val answer = try {
            // One word = a topic (keyword file); a sentence = an exact question (the fallback file)
            // "now:temperature" = a live reading said at once, built by code on the laptop (no AI, under a second)
            (if (question.startsWith("now:")) AgentClient.now(question.removePrefix("now:"))
             else if (' ' in question) AgentClient.ask(question) else AgentClient.askTopic(question))
                .ifBlank { "Sorry, I have no answer for that right now." }
        } catch (e: Exception) {
            status("Agent error: ${e.message}")
            "Sorry, I can't reach AquaMaa's brain right now. Please check that the laptop service is running."
        }
        status("Answer: $answer")
        SayBuilder.with(ctx).withText(answer).withLocale(locale).build().run()
    }

    override fun stop() {}
}
