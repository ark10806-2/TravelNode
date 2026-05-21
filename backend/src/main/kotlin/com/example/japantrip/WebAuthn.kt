package com.example.japantrip

import com.fasterxml.jackson.databind.ObjectMapper
import java.math.BigInteger
import java.net.URI
import java.security.AlgorithmParameters
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.PublicKey
import java.security.SecureRandom
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPublicKeySpec
import java.security.spec.RSAPublicKeySpec
import java.time.OffsetDateTime
import java.util.Base64
import javax.sql.DataSource

data class WebAuthnRp(
  val name: String,
  val id: String
)

data class WebAuthnUser(
  val id: String,
  val name: String,
  val displayName: String
)

data class WebAuthnCredentialParameter(
  val type: String = "public-key",
  val alg: Int
)

data class WebAuthnCredentialDescriptor(
  val type: String = "public-key",
  val id: String
)

data class WebAuthnAuthenticatorSelection(
  val authenticatorAttachment: String = "platform",
  val residentKey: String = "required",
  val requireResidentKey: Boolean = true,
  val userVerification: String = "required"
)

data class WebAuthnRegistrationOptions(
  val challenge: String,
  val rp: WebAuthnRp,
  val user: WebAuthnUser,
  val pubKeyCredParams: List<WebAuthnCredentialParameter>,
  val timeout: Long = 60_000,
  val authenticatorSelection: WebAuthnAuthenticatorSelection = WebAuthnAuthenticatorSelection(),
  val attestation: String = "none",
  val excludeCredentials: List<WebAuthnCredentialDescriptor>
)

data class WebAuthnAuthenticationOptions(
  val challenge: String,
  val timeout: Long = 60_000,
  val rpId: String,
  val userVerification: String = "required"
)

data class WebAuthnRegistrationCredential(
  val id: String? = null,
  val rawId: String? = null,
  val type: String? = null,
  val response: WebAuthnRegistrationResponse? = null
)

data class WebAuthnRegistrationResponse(
  val clientDataJSON: String? = null,
  val attestationObject: String? = null
)

data class WebAuthnAuthenticationCredential(
  val id: String? = null,
  val rawId: String? = null,
  val type: String? = null,
  val response: WebAuthnAuthenticationResponse? = null
)

data class WebAuthnAuthenticationResponse(
  val clientDataJSON: String? = null,
  val authenticatorData: String? = null,
  val signature: String? = null,
  val userHandle: String? = null
)

private data class StoredWebAuthnChallenge(
  val challenge: String,
  val username: String?,
  val rpId: String,
  val origin: String
)

private data class ParsedAttestationAuthData(
  val credentialId: ByteArray,
  val publicKeyCose: ByteArray,
  val signCount: Long
)

private data class ParsedAssertionAuthData(
  val signCount: Long,
  val userPresent: Boolean,
  val userVerified: Boolean,
  val rpIdHash: ByteArray
)

private data class StoredWebAuthnCredential(
  val credentialId: String,
  val username: String,
  val publicKeyCose: ByteArray,
  val signCount: Long
)

class WebAuthnRepository(
  private val dataSource: DataSource
) {
  private val secureRandom = SecureRandom()
  private val jsonMapper = ObjectMapper()

  fun hasCredential(username: String): Boolean {
    val normalizedUsername = normalizeUsername(username)
    dataSource.connection.use { connection ->
      connection.prepareStatement("SELECT 1 FROM webauthn_credentials WHERE username = ? LIMIT 1").use { statement ->
        statement.setString(1, normalizedUsername)
        statement.executeQuery().use { rows -> return rows.next() }
      }
    }
  }

  fun beginRegistration(username: String, origin: String): WebAuthnRegistrationOptions? {
    val normalizedUsername = normalizeUsername(username)
    val userHandle = ensureUserHandle(normalizedUsername) ?: return null
    val rpId = rpIdFromOrigin(origin) ?: return null
    val challenge = generateChallenge()

    storeChallenge(
      challenge = challenge,
      username = normalizedUsername,
      challengeType = "registration",
      rpId = rpId,
      origin = origin
    )

    return WebAuthnRegistrationOptions(
      challenge = challenge,
      rp = WebAuthnRp(name = "Japan Trip Planner", id = rpId),
      user = WebAuthnUser(id = userHandle, name = normalizedUsername, displayName = normalizedUsername),
      pubKeyCredParams = listOf(
        WebAuthnCredentialParameter(alg = -7),
        WebAuthnCredentialParameter(alg = -257)
      ),
      excludeCredentials = credentialsForUser(normalizedUsername)
    )
  }

  fun finishRegistration(username: String, credential: WebAuthnRegistrationCredential): Boolean {
    val normalizedUsername = normalizeUsername(username)
    if (credential.type != "public-key") return false

    val response = credential.response ?: return false
    val clientDataJson = decodeBase64Url(response.clientDataJSON ?: return false)
    val attestationObject = decodeBase64Url(response.attestationObject ?: return false)
    val rawCredentialId = decodeBase64Url(credential.rawId?.takeIf(String::isNotBlank) ?: return false)
    val clientData = parseClientData(clientDataJson, expectedType = "webauthn.create") ?: return false
    val storedChallenge = findChallenge(clientData.challenge, "registration", normalizedUsername) ?: return false

    if (clientData.origin != storedChallenge.origin) return false

    val attestation = CborReader(attestationObject).readMapStringKeys()
    val authData = attestation["authData"] as? ByteArray ?: return false
    val parsedAuthData = parseAttestationAuthData(authData, storedChallenge.rpId) ?: return false
    if (!rawCredentialId.contentEquals(parsedAuthData.credentialId)) return false

    val credentialId = encodeBase64Url(parsedAuthData.credentialId)
    dataSource.connection.use { connection ->
      connection.prepareStatement(
        """
        INSERT INTO webauthn_credentials (credential_id, username, public_key_cose, sign_count, last_used_at)
        VALUES (?, ?, ?, ?, now())
        ON CONFLICT (credential_id) DO UPDATE
        SET
          username = EXCLUDED.username,
          public_key_cose = EXCLUDED.public_key_cose,
          sign_count = EXCLUDED.sign_count,
          last_used_at = now()
        """.trimIndent()
      ).use { statement ->
        statement.setString(1, credentialId)
        statement.setString(2, normalizedUsername)
        statement.setBytes(3, parsedAuthData.publicKeyCose)
        statement.setLong(4, parsedAuthData.signCount)
        statement.executeUpdate()
      }
    }

    deleteChallenge(storedChallenge.challenge)
    return true
  }

  fun beginAuthentication(origin: String): WebAuthnAuthenticationOptions? {
    val rpId = rpIdFromOrigin(origin) ?: return null
    val challenge = generateChallenge()

    storeChallenge(
      challenge = challenge,
      username = null,
      challengeType = "authentication",
      rpId = rpId,
      origin = origin
    )

    return WebAuthnAuthenticationOptions(
      challenge = challenge,
      rpId = rpId
    )
  }

  fun finishAuthentication(credential: WebAuthnAuthenticationCredential): AuthSessionResponse? {
    if (credential.type != "public-key") return null

    val response = credential.response ?: return null
    val rawId = credential.rawId?.takeIf(String::isNotBlank) ?: credential.id?.takeIf(String::isNotBlank) ?: return null
    val clientDataJson = decodeBase64Url(response.clientDataJSON ?: return null)
    val authenticatorData = decodeBase64Url(response.authenticatorData ?: return null)
    val signature = decodeBase64Url(response.signature ?: return null)
    val clientData = parseClientData(clientDataJson, expectedType = "webauthn.get") ?: return null
    val storedChallenge = findChallenge(clientData.challenge, "authentication", null) ?: return null

    if (clientData.origin != storedChallenge.origin) return null

    val storedCredential = findCredential(rawId) ?: return null
    val parsedAuthData = parseAssertionAuthData(authenticatorData, storedChallenge.rpId) ?: return null
    if (!parsedAuthData.userPresent || !parsedAuthData.userVerified) return null

    val publicKey = publicKeyFromCose(storedCredential.publicKeyCose) ?: return null
    val signedBytes = authenticatorData + sha256(clientDataJson)
    if (!verifySignature(publicKey, signedBytes, signature)) return null

    updateCredentialUsage(rawId, parsedAuthData.signCount, storedCredential.signCount)
    deleteChallenge(storedChallenge.challenge)
    return createSession(storedCredential.username)
  }

  private fun ensureUserHandle(username: String): String? {
    dataSource.connection.use { connection ->
      connection.prepareStatement("SELECT webauthn_user_handle FROM app_users WHERE username = ?").use { statement ->
        statement.setString(1, username)
        statement.executeQuery().use { rows ->
          if (!rows.next()) return null

          val existing = rows.getString("webauthn_user_handle")
          if (!existing.isNullOrBlank()) return existing
        }
      }

      val userHandle = generateChallenge()
      connection.prepareStatement("UPDATE app_users SET webauthn_user_handle = ?, updated_at = now() WHERE username = ?").use { statement ->
        statement.setString(1, userHandle)
        statement.setString(2, username)
        statement.executeUpdate()
      }
      return userHandle
    }
  }

  private fun credentialsForUser(username: String): List<WebAuthnCredentialDescriptor> {
    dataSource.connection.use { connection ->
      connection.prepareStatement("SELECT credential_id FROM webauthn_credentials WHERE username = ?").use { statement ->
        statement.setString(1, username)
        statement.executeQuery().use { rows ->
          val credentials = mutableListOf<WebAuthnCredentialDescriptor>()
          while (rows.next()) {
            credentials += WebAuthnCredentialDescriptor(id = rows.getString("credential_id"))
          }
          return credentials
        }
      }
    }
  }

  private fun storeChallenge(
    challenge: String,
    username: String?,
    challengeType: String,
    rpId: String,
    origin: String
  ) {
    cleanupExpiredChallenges()
    dataSource.connection.use { connection ->
      connection.prepareStatement(
        """
        INSERT INTO webauthn_challenges (challenge, username, challenge_type, rp_id, origin, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """.trimIndent()
      ).use { statement ->
        statement.setString(1, challenge)
        statement.setString(2, username)
        statement.setString(3, challengeType)
        statement.setString(4, rpId)
        statement.setString(5, origin)
        statement.setObject(6, OffsetDateTime.now().plusMinutes(5))
        statement.executeUpdate()
      }
    }
  }

  private fun findChallenge(challenge: String, challengeType: String, username: String?): StoredWebAuthnChallenge? {
    cleanupExpiredChallenges()
    dataSource.connection.use { connection ->
      connection.prepareStatement(
        """
        SELECT challenge, username, rp_id, origin
        FROM webauthn_challenges
        WHERE challenge = ?
          AND challenge_type = ?
          AND expires_at > now()
          AND ((? IS NULL AND username IS NULL) OR username = ?)
        """.trimIndent()
      ).use { statement ->
        statement.setString(1, challenge)
        statement.setString(2, challengeType)
        statement.setString(3, username)
        statement.setString(4, username)
        statement.executeQuery().use { rows ->
          return if (rows.next()) {
            StoredWebAuthnChallenge(
              challenge = rows.getString("challenge"),
              username = rows.getString("username"),
              rpId = rows.getString("rp_id"),
              origin = rows.getString("origin")
            )
          } else {
            null
          }
        }
      }
    }
  }

  private fun deleteChallenge(challenge: String) {
    dataSource.connection.use { connection ->
      connection.prepareStatement("DELETE FROM webauthn_challenges WHERE challenge = ?").use { statement ->
        statement.setString(1, challenge)
        statement.executeUpdate()
      }
    }
  }

  private fun cleanupExpiredChallenges() {
    dataSource.connection.use { connection ->
      connection.prepareStatement("DELETE FROM webauthn_challenges WHERE expires_at <= now()").use { statement ->
        statement.executeUpdate()
      }
    }
  }

  private fun findCredential(credentialId: String): StoredWebAuthnCredential? {
    dataSource.connection.use { connection ->
      connection.prepareStatement(
        """
        SELECT credential_id, username, public_key_cose, sign_count
        FROM webauthn_credentials
        WHERE credential_id = ?
        """.trimIndent()
      ).use { statement ->
        statement.setString(1, credentialId)
        statement.executeQuery().use { rows ->
          return if (rows.next()) {
            StoredWebAuthnCredential(
              credentialId = rows.getString("credential_id"),
              username = rows.getString("username"),
              publicKeyCose = rows.getBytes("public_key_cose"),
              signCount = rows.getLong("sign_count")
            )
          } else {
            null
          }
        }
      }
    }
  }

  private fun updateCredentialUsage(credentialId: String, nextSignCount: Long, currentSignCount: Long) {
    val signCount = if (nextSignCount > currentSignCount) nextSignCount else currentSignCount
    dataSource.connection.use { connection ->
      connection.prepareStatement(
        """
        UPDATE webauthn_credentials
        SET sign_count = ?, last_used_at = now()
        WHERE credential_id = ?
        """.trimIndent()
      ).use { statement ->
        statement.setLong(1, signCount)
        statement.setString(2, credentialId)
        statement.executeUpdate()
      }
    }
  }

  private fun createSession(username: String): AuthSessionResponse {
    val token = generateChallenge()
    val expiresAt = OffsetDateTime.now().plusDays(30)

    dataSource.connection.use { connection ->
      connection.prepareStatement("DELETE FROM auth_sessions WHERE expires_at <= now()").use { statement ->
        statement.executeUpdate()
      }
      connection.prepareStatement("INSERT INTO auth_sessions (token, username, expires_at) VALUES (?, ?, ?)").use { statement ->
        statement.setString(1, token)
        statement.setString(2, username)
        statement.setObject(3, expiresAt)
        statement.executeUpdate()
      }
    }

    return AuthSessionResponse(token, expiresAt, username)
  }

  private fun parseClientData(clientDataJson: ByteArray, expectedType: String): WebAuthnClientData? {
    val root = jsonMapper.readTree(clientDataJson)
    val type = root.path("type").asText()
    val challenge = root.path("challenge").asText()
    val origin = root.path("origin").asText()
    if (type != expectedType || challenge.isBlank() || origin.isBlank()) return null

    return WebAuthnClientData(challenge = challenge, origin = origin)
  }

  private fun parseAttestationAuthData(authData: ByteArray, rpId: String): ParsedAttestationAuthData? {
    if (authData.size < 55) return null
    val rpHash = authData.copyOfRange(0, 32)
    if (!rpHash.contentEquals(sha256(rpId.toByteArray(Charsets.UTF_8)))) return null

    val flags = authData[32].toInt()
    val userPresent = flags and 0x01 != 0
    val userVerified = flags and 0x04 != 0
    val hasAttestedCredentialData = flags and 0x40 != 0
    if (!userPresent || !userVerified || !hasAttestedCredentialData) return null

    val signCount = unsignedInt(authData, 33)
    var index = 37 + 16
    if (authData.size < index + 2) return null

    val credentialIdLength = ((authData[index].toInt() and 0xff) shl 8) or (authData[index + 1].toInt() and 0xff)
    index += 2
    if (authData.size < index + credentialIdLength) return null

    val credentialId = authData.copyOfRange(index, index + credentialIdLength)
    index += credentialIdLength

    val reader = CborReader(authData, index)
    reader.readAny()
    val publicKeyCose = authData.copyOfRange(index, reader.position)

    return ParsedAttestationAuthData(credentialId = credentialId, publicKeyCose = publicKeyCose, signCount = signCount)
  }

  private fun parseAssertionAuthData(authData: ByteArray, rpId: String): ParsedAssertionAuthData? {
    if (authData.size < 37) return null
    val rpHash = authData.copyOfRange(0, 32)
    if (!rpHash.contentEquals(sha256(rpId.toByteArray(Charsets.UTF_8)))) return null

    val flags = authData[32].toInt()
    return ParsedAssertionAuthData(
      signCount = unsignedInt(authData, 33),
      userPresent = flags and 0x01 != 0,
      userVerified = flags and 0x04 != 0,
      rpIdHash = rpHash
    )
  }

  private fun publicKeyFromCose(coseBytes: ByteArray): PublicKey? {
    val cose = CborReader(coseBytes).readAny() as? Map<*, *> ?: return null
    val keyType = (cose[1L] as? Number)?.toLong()
    val algorithm = (cose[3L] as? Number)?.toLong()

    return when {
      keyType == 2L && algorithm == -7L -> ecPublicKey(cose)
      keyType == 3L && algorithm == -257L -> rsaPublicKey(cose)
      else -> null
    }
  }

  private fun ecPublicKey(cose: Map<*, *>): ECPublicKey? {
    val curve = (cose[-1L] as? Number)?.toLong()
    val x = cose[-2L] as? ByteArray
    val y = cose[-3L] as? ByteArray
    if (curve != 1L || x == null || y == null) return null

    val parameters = AlgorithmParameters.getInstance("EC")
    parameters.init(ECGenParameterSpec("secp256r1"))
    val parameterSpec = parameters.getParameterSpec(ECParameterSpec::class.java)
    val point = ECPoint(BigInteger(1, x), BigInteger(1, y))
    val keySpec = ECPublicKeySpec(point, parameterSpec)
    return KeyFactory.getInstance("EC").generatePublic(keySpec) as ECPublicKey
  }

  private fun rsaPublicKey(cose: Map<*, *>): PublicKey? {
    val modulus = cose[-1L] as? ByteArray
    val exponent = cose[-2L] as? ByteArray
    if (modulus == null || exponent == null) return null

    return KeyFactory.getInstance("RSA").generatePublic(
      RSAPublicKeySpec(BigInteger(1, modulus), BigInteger(1, exponent))
    )
  }

  private fun verifySignature(publicKey: PublicKey, signedBytes: ByteArray, signature: ByteArray): Boolean {
    val algorithm = when (publicKey.algorithm) {
      "EC" -> "SHA256withECDSA"
      "RSA" -> "SHA256withRSA"
      else -> return false
    }

    return Signature.getInstance(algorithm).run {
      initVerify(publicKey)
      update(signedBytes)
      verify(signature)
    }
  }

  private fun generateChallenge(): String {
    val bytes = ByteArray(32).also(secureRandom::nextBytes)
    return encodeBase64Url(bytes)
  }

  private fun decodeBase64Url(value: String): ByteArray = Base64.getUrlDecoder().decode(value)

  private fun encodeBase64Url(value: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(value)

  private fun sha256(value: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(value)

  private fun unsignedInt(bytes: ByteArray, index: Int): Long {
    return ((bytes[index].toLong() and 0xff) shl 24) or
      ((bytes[index + 1].toLong() and 0xff) shl 16) or
      ((bytes[index + 2].toLong() and 0xff) shl 8) or
      (bytes[index + 3].toLong() and 0xff)
  }

  private fun rpIdFromOrigin(origin: String): String? = runCatching { URI(origin).host }.getOrNull()

  private fun normalizeUsername(username: String): String = username.trim().lowercase()
}

private data class WebAuthnClientData(
  val challenge: String,
  val origin: String
)

private class CborReader(
  private val bytes: ByteArray,
  startPosition: Int = 0
) {
  var position: Int = startPosition
    private set

  fun readMapStringKeys(): Map<String, Any?> {
    val raw = readAny() as? Map<*, *> ?: return emptyMap()
    return raw.mapNotNull { (key, value) -> (key as? String)?.let { it to value } }.toMap()
  }

  fun readAny(): Any? {
    val initial = readByte().toInt() and 0xff
    val major = initial shr 5
    val additional = initial and 0x1f

    return when (major) {
      0 -> readLength(additional)
      1 -> -1L - readLength(additional)
      2 -> readBytes(readLength(additional).toInt())
      3 -> readBytes(readLength(additional).toInt()).toString(Charsets.UTF_8)
      4 -> List(readLength(additional).toInt()) { readAny() }
      5 -> buildMap<Any?, Any?> {
        repeat(readLength(additional).toInt()) {
          put(readAny(), readAny())
        }
      }
      6 -> {
        readLength(additional)
        readAny()
      }
      7 -> readSimple(additional)
      else -> error("Unsupported CBOR major type: $major")
    }
  }

  private fun readSimple(additional: Int): Any? {
    return when (additional) {
      20 -> false
      21 -> true
      22 -> null
      23 -> null
      24 -> readByte().toInt() and 0xff
      else -> error("Unsupported CBOR simple value: $additional")
    }
  }

  private fun readLength(additional: Int): Long {
    return when {
      additional < 24 -> additional.toLong()
      additional == 24 -> readByte().toLong() and 0xff
      additional == 25 -> ((readByte().toLong() and 0xff) shl 8) or (readByte().toLong() and 0xff)
      additional == 26 -> (0 until 4).fold(0L) { acc, _ -> (acc shl 8) or (readByte().toLong() and 0xff) }
      additional == 27 -> (0 until 8).fold(0L) { acc, _ -> (acc shl 8) or (readByte().toLong() and 0xff) }
      else -> error("Unsupported CBOR length: $additional")
    }
  }

  private fun readBytes(length: Int): ByteArray {
    val end = position + length
    require(end <= bytes.size) { "CBOR byte string exceeds input size" }
    return bytes.copyOfRange(position, end).also { position = end }
  }

  private fun readByte(): Byte {
    require(position < bytes.size) { "CBOR input ended unexpectedly" }
    return bytes[position++]
  }
}
