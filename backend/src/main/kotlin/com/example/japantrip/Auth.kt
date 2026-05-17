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
  val password: String? = null
)

data class AuthChangePasswordRequest(
  val currentPassword: String? = null,
  val newPassword: String? = null
)

data class AuthSessionResponse(
  val token: String,
  val expiresAt: OffsetDateTime
)

class AuthRepository(
  private val dataSource: DataSource,
  private val initialPassword: String = System.getenv("APP_INITIAL_PASSWORD") ?: "1234"
) {
  private val secureRandom = SecureRandom()

  fun ensureInitialized() {
    dataSource.connection.use { connection ->
      connection.prepareStatement("SELECT password_hash FROM app_auth WHERE id = true").use { statement ->
        statement.executeQuery().use { rows ->
          if (rows.next()) return
        }
      }

      connection.prepareStatement("INSERT INTO app_auth (id, password_hash) VALUES (true, ?)").use { statement ->
        statement.setString(1, hashPassword(initialPassword))
        statement.executeUpdate()
      }
    }
  }

  fun createSession(password: String): AuthSessionResponse? {
    if (!verifyPassword(password)) return null

    val token = generateToken()
    val expiresAt = OffsetDateTime.now().plusDays(30)

    cleanupExpiredSessions()
    dataSource.connection.use { connection ->
      connection.prepareStatement("INSERT INTO auth_sessions (token, expires_at) VALUES (?, ?)").use { statement ->
        statement.setString(1, token)
        statement.setObject(2, expiresAt)
        statement.executeUpdate()
      }
    }

    return AuthSessionResponse(token, expiresAt)
  }

  fun isValidToken(token: String?): Boolean {
    if (token.isNullOrBlank()) return false

    cleanupExpiredSessions()
    dataSource.connection.use { connection ->
      connection.prepareStatement("SELECT 1 FROM auth_sessions WHERE token = ? AND expires_at > now()").use { statement ->
        statement.setString(1, token)
        statement.executeQuery().use { rows ->
          return rows.next()
        }
      }
    }
  }

  fun changePassword(currentPassword: String, newPassword: String): AuthSessionResponse? {
    if (!verifyPassword(currentPassword)) return null

    dataSource.connection.use { connection ->
      connection.autoCommit = false
      try {
        connection.prepareStatement("UPDATE app_auth SET password_hash = ?, updated_at = now() WHERE id = true").use { statement ->
          statement.setString(1, hashPassword(newPassword))
          statement.executeUpdate()
        }
        connection.prepareStatement("DELETE FROM auth_sessions").use { statement ->
          statement.executeUpdate()
        }

        val token = generateToken()
        val expiresAt = OffsetDateTime.now().plusDays(30)
        connection.prepareStatement("INSERT INTO auth_sessions (token, expires_at) VALUES (?, ?)").use { statement ->
          statement.setString(1, token)
          statement.setObject(2, expiresAt)
          statement.executeUpdate()
        }
        connection.commit()
        return AuthSessionResponse(token, expiresAt)
      } catch (cause: Exception) {
        connection.rollback()
        throw cause
      } finally {
        connection.autoCommit = true
      }
    }
  }

  private fun verifyPassword(password: String): Boolean {
    val storedHash = dataSource.connection.use { connection ->
      connection.prepareStatement("SELECT password_hash FROM app_auth WHERE id = true").use { statement ->
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
}

suspend fun ApplicationCall.requireAuth(authRepository: AuthRepository): Boolean {
  val token = request.headers[HttpHeaders.Authorization]
    ?.removePrefix("Bearer")
    ?.trim()
    ?.takeIf(String::isNotBlank)

  if (authRepository.isValidToken(token)) return true

  respondError(HttpStatusCode.Unauthorized, "authentication required")
  return false
}
