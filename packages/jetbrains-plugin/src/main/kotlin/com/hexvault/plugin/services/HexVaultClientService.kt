package com.hexvault.plugin.services

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.hexvault.plugin.settings.HexVaultSettings
import com.intellij.openapi.components.Service
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

data class SearchHit(val id: String?, val title: String?, val type: String?, val content: String?, val rankScore: Double?)
data class SearchResult(val query: String?, val count: Int?, val results: List<SearchHit>?)
data class ChatResult(val answer: String?, val source: String?)

@Service(Service.Level.APP)
class HexVaultClientService {
    private val gson = Gson()
    private val http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()

    private fun settings() = HexVaultSettings.getInstance().state

    private fun request(method: String, path: String, body: String? = null): String {
        val s = settings()
        val builder = HttpRequest.newBuilder()
            .uri(URI.create("${s.baseUrl}$path"))
            .timeout(Duration.ofMillis(s.timeoutMs.toLong()))
            .header("Accept", "application/json")
        if (s.token.isNotBlank()) builder.header("Authorization", "Bearer ${s.token}")
        when (method) {
            "GET" -> builder.GET()
            "POST" -> {
                builder.header("Content-Type", "application/json")
                builder.POST(HttpRequest.BodyPublishers.ofString(body ?: "{}"))
            }
            else -> throw IllegalArgumentException("Unsupported method $method")
        }
        val res = http.send(builder.build(), HttpResponse.BodyHandlers.ofString())
        if (res.statusCode() !in 200..299) throw RuntimeException("HEXVault API ${res.statusCode()}: ${res.body()}")
        return res.body()
    }

    fun health(): JsonObject = JsonParser.parseString(request("GET", "/health")).asJsonObject

    fun search(query: String, limit: Int = 15): SearchResult {
        val q = java.net.URLEncoder.encode(query, Charsets.UTF_8)
        return gson.fromJson(request("GET", "/v1/search?q=$q&limit=$limit"), SearchResult::class.java)
    }

    fun addMemory(content: String, title: String? = null, type: String = "note", tags: List<String> = emptyList()): JsonObject {
        val payload = JsonObject().apply {
            addProperty("content", content)
            addProperty("title", title ?: content.take(80))
            addProperty("type", type)
            add("tags", gson.toJsonTree(tags))
            addProperty("source", "jetbrains-plugin")
        }
        return JsonParser.parseString(request("POST", "/v1/memories", gson.toJson(payload))).asJsonObject
    }

    fun chat(question: String): ChatResult {
        val payload = JsonObject().apply { addProperty("question", question) }
        return gson.fromJson(request("POST", "/v1/chat", gson.toJson(payload)), ChatResult::class.java)
    }
}
