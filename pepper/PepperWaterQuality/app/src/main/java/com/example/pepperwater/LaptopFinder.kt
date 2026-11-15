package com.example.pepperwater

import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.URL
import java.util.concurrent.ExecutorCompletionService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Finds the laptop running AquaMaa on Pepper's Wi-Fi by itself (14 Nov: the laptop's address changed from .113 to
 * .109 after reconnecting, and the app had the old one built in). It asks every address on the tablet's network
 * for AquaMaa's /health page, in parallel, and returns the one that answers (about 1-3 s). No network calls on the
 * UI thread.
 */
object LaptopFinder {
    /** True if AquaMaa answers at this address. */
    fun healthy(host: String, timeoutMs: Int = 1500): Boolean = try {
        val c = URL("http://$host:8000/health").openConnection() as HttpURLConnection
        c.connectTimeout = timeoutMs
        c.readTimeout = timeoutMs
        try { c.responseCode == 200 && c.inputStream.bufferedReader().use { it.readText() }.contains("status") }
        finally { c.disconnect() }
    } catch (e: Exception) { false }

    /** The tablet's own network, such as "192.168.8." */
    private fun prefix(): String? = NetworkInterface.getNetworkInterfaces().toList()
        .filter { it.isUp && !it.isLoopback }
        .flatMap { it.inetAddresses.toList() }
        .filterIsInstance<Inet4Address>()
        .map { it.hostAddress }
        .firstOrNull { it.startsWith("192.168.") || it.startsWith("10.") || it.startsWith("172.") }
        ?.substringBeforeLast('.')?.plus(".")

    /** The address of the laptop running AquaMaa on this network, or null. */
    fun find(): String? {
        val net = prefix() ?: return null
        val pool = Executors.newFixedThreadPool(48)
        val done = ExecutorCompletionService<String?>(pool)
        for (i in 1..254) done.submit { "$net$i".takeIf { healthy(it, 700) } }
        try {
            repeat(254) {
                val f = done.poll(4, TimeUnit.SECONDS) ?: return null
                val host = f.get()
                if (host != null) return host
            }
            return null
        } finally {
            pool.shutdownNow()
        }
    }
}
