package com.example.japantrip

import io.ktor.http.HttpHeaders
import io.ktor.server.application.ApplicationCall
import io.ktor.server.plugins.origin
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

class AuthRateLimiter(
  private val maxFailures: Int = 6,
  private val window: Duration = Duration.ofMinutes(10),
  private val blockDuration: Duration = Duration.ofMinutes(10)
) {
  private data class AttemptState(
    var failures: Int,
    var windowStartedAt: Instant,
    var blockedUntil: Instant?
  )

  private val attempts = ConcurrentHashMap<String, AttemptState>()

  fun isBlocked(key: String): Boolean {
    val now = Instant.now()
    val state = attempts[key] ?: return false
    val blockedUntil = state.blockedUntil
    if (blockedUntil != null && blockedUntil.isAfter(now)) return true
    if (blockedUntil != null) attempts.remove(key)
    return false
  }

  fun recordSuccess(key: String) {
    attempts.remove(key)
  }

  fun recordFailure(key: String) {
    val now = Instant.now()
    attempts.compute(key) { _, previous ->
      val state = previous?.takeIf { Duration.between(it.windowStartedAt, now) <= window }
        ?: AttemptState(failures = 0, windowStartedAt = now, blockedUntil = null)
      state.failures += 1
      if (state.failures >= maxFailures) {
        state.blockedUntil = now.plus(blockDuration)
      }
      state
    }
  }
}

fun ApplicationCall.authRateLimitKey(username: String?): String {
  val forwardedFor = request.headers["X-Forwarded-For"]
    ?.split(",")
    ?.firstOrNull()
    ?.trim()
  val client = forwardedFor
    ?: request.headers["X-Real-IP"]?.trim()
    ?: request.origin.remoteHost
    ?: request.headers[HttpHeaders.Host]?.trim()
    ?: "unknown"
  return "${client}|${username?.trim()?.lowercase().orEmpty()}"
}
