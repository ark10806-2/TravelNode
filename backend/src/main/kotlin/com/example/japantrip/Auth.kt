package com.example.japantrip

import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respond
import java.security.SecureRandom
import java.time.OffsetDateTime
import java.util.Base64
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.sql.DataSource

data class AuthLoginRequest(
  val username: String? = null,
  val password: String? = null
)

data class AuthChangePasswordRequest(
  val currentPassword: String? = null,
  val newPassword: String? = null
)

data class AuthSessionResponse(
  val token: String,
  val expiresAt: OffsetDateTime,
  val username: String
)

private data class InitialAuthUser(
  val username: String,
  val passwordHash: String
)

class AuthRepository(
  private val dataSource: DataSource
) {
  private val secureRandom = SecureRandom()
  private val initialUsers = listOf(
    InitialAuthUser(
      username = "seungchan",
      passwordHash = "120000:sWbYK9Jpj9Xg4lu3lSH5qA==:sqN0uLD8kRoosbP4Rnd+V6IHyNMgNNQoFwpY/iZzlBU="
    ),
    InitialAuthUser(
      username = "boyoung",
      passwordHash = "120000:GI38uNn/jPnAeQcsInLXFg==:tBS2keYk+xjgL0uvrlt9qO2lPwYq6dQdC8BOQkzkP2s="
    )
  )

  fun ensureInitialized() {
    dataSource.connection.use { connection ->
      connection.prepareStatement(
        """
        INSERT INTO app_users (username, password_hash)
        VALUES (?, ?)
        ON CONFLICT (username) DO NOTHING
        """.trimIndent()
      ).use { statement ->
        initialUsers.forEach { user ->
          statement.setString(1, user.username)
          statement.setString(2, user.passwordHash)
          statement.addBatch()
        }
        statement.executeBatch()
      }
      connection.prepareStatement("DELETE FROM auth_sessions WHERE username IS NULL").use { statement ->
        statement.executeUpdate()
      }
    }
  }

  fun createSession(username: String, password: String): AuthSessionResponse? {
    val normalizedUsername = normalizeUsername(username)
    if (!verifyPassword(normalizedUsername, password)) return null

    val token = generateToken()
    val expiresAt = OffsetDateTime.now().plusDays(30)

    cleanupExpiredSessions()
    dataSource.connection.use { connection ->
      connection.prepareStatement("INSERT INTO auth_sessions (token, username, expires_at) VALUES (?, ?, ?)").use { statement ->
        statement.setString(1, token)
        statement.setString(2, normalizedUsername)
        statement.setObject(3, expiresAt)
        statement.executeUpdate()
      }
    }

    return AuthSessionResponse(token, expiresAt, normalizedUsername)
  }

  fun isValidToken(token: String?): Boolean {
    return usernameForToken(token) != null
  }

  fun usernameForToken(token: String?): String? {
    if (token.isNullOrBlank()) return null
    cleanupExpiredSessions()

    dataSource.connection.use { connection ->
      connection.prepareStatement(
        """
        SELECT username
        FROM auth_sessions
        WHERE token = ?
          AND username IS NOT NULL
          AND expires_at > now()
        """.trimIndent()
      ).use { statement ->
        statement.setString(1, token)
        statement.executeQuery().use { rows ->
          return if (rows.next()) rows.getString("username") else null
        }
      }
    }
  }

  fun changePassword(token: String?, currentPassword: String, newPassword: String): AuthSessionResponse? {
    val username = usernameForToken(token) ?: return null
    if (!verifyPassword(username, currentPassword)) return null

    dataSource.connection.use { connection ->
      connection.autoCommit = false
      try {
        connection.prepareStatement("UPDATE app_users SET password_hash = ?, updated_at = now() WHERE username = ?").use { statement ->
          statement.setString(1, hashPassword(newPassword))
          statement.setString(2, username)
          statement.executeUpdate()
        }
        connection.prepareStatement("DELETE FROM auth_sessions WHERE username = ?").use { statement ->
          statement.setString(1, username)
          statement.executeUpdate()
        }

        val token = generateToken()
        val expiresAt = OffsetDateTime.now().plusDays(30)
        connection.prepareStatement("INSERT INTO auth_sessions (token, username, expires_at) VALUES (?, ?, ?)").use { statement ->
          statement.setString(1, token)
          statement.setString(2, username)
          statement.setObject(3, expiresAt)
          statement.executeUpdate()
        }
        connection.commit()
        return AuthSessionResponse(token, expiresAt, username)
      } catch (cause: Exception) {
        connection.rollback()
        throw cause
      } finally {
        connection.autoCommit = true
      }
    }
  }

  private fun verifyPassword(username: String, password: String): Boolean {
    val storedHash = dataSource.connection.use { connection ->
      connection.prepareStatement("SELECT password_hash FROM app_users WHERE username = ?").use { statement ->
        statement.setString(1, username)
        statement.executeQuery().use { rows ->
          if (rows.next()) rows.getString("password_hash") else null
        }
      }
    } ?: return false

    val parts = storedHash.split(":")
    if (parts.size != 3) return false

    val iterations = parts[0].toIntOrNull() ?: return false
    val salt = Base64.getDecoder().decode(parts[1])
    val expected = Base64.getDecoder().decode(parts[2])
    val actual = pbkdf2(password, salt, iterations)

    if (actual.size != expected.size) return false
    var diff = 0
    actual.indices.forEach { index -> diff = diff or (actual[index].toInt() xor expected[index].toInt()) }
    return diff == 0
  }

  private fun hashPassword(password: String): String {
    val iterations = 120_000
    val salt = ByteArray(16).also(secureRandom::nextBytes)
    val hash = pbkdf2(password, salt, iterations)
    return listOf(
      iterations.toString(),
      Base64.getEncoder().encodeToString(salt),
      Base64.getEncoder().encodeToString(hash)
    ).joinToString(":")
  }

  private fun pbkdf2(password: String, salt: ByteArray, iterations: Int): ByteArray {
    val spec = PBEKeySpec(password.toCharArray(), salt, iterations, 256)
    return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
  }

  private fun generateToken(): String {
    val bytes = ByteArray(32).also(secureRandom::nextBytes)
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
  }

  private fun cleanupExpiredSessions() {
    dataSource.connection.use { connection ->
      connection.prepareStatement("DELETE FROM auth_sessions WHERE expires_at <= now()").use { statement ->
        statement.executeUpdate()
      }
    }
  }

  private fun normalizeUsername(username: String): String = username.trim().lowercase()
}

suspend fun ApplicationCall.requireAuth(authRepository: AuthRepository): Boolean {
  val token = bearerToken()

  if (authRepository.isValidToken(token)) return true

  respondError(HttpStatusCode.Unauthorized, "authentication required")
  return false
}

fun ApplicationCall.bearerToken(): String? {
  return request.headers[HttpHeaders.Authorization]
    ?.removePrefix("Bearer")
    ?.trim()
    ?.takeIf(String::isNotBlank)
}
