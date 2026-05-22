package com.example.japantrip

import io.ktor.http.HttpStatusCode
import io.ktor.http.HttpHeaders
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route

fun Route.authRoutes(authRepository: AuthRepository, webAuthnRepository: WebAuthnRepository, config: AppConfig) {
  val passwordLoginLimiter = AuthRateLimiter()
  val passkeyLoginLimiter = AuthRateLimiter(maxFailures = 10)

  route("/api/auth") {
    get("session") {
      val username = authRepository.usernameForToken(call.bearerToken())
      if (username == null) {
        call.respondError(HttpStatusCode.Unauthorized, "authentication required")
        return@get
      }

      call.respond(DataResponse(mapOf("authenticated" to true, "username" to username)))
    }

    post("login") {
      val request = call.receive<AuthLoginRequest>()
      val username = request.username?.takeIf(String::isNotBlank)
      val password = request.password?.takeIf(String::isNotBlank)
      if (username == null || password == null) {
        call.respondError(HttpStatusCode.BadRequest, "username and password are required")
        return@post
      }

      if (webAuthnRepository.hasCredential(username)) {
        call.respondError(HttpStatusCode.Forbidden, "Face ID가 등록된 계정입니다. Face ID로 로그인해주세요.")
        return@post
      }

      val rateLimitKey = call.authRateLimitKey(username)
      if (passwordLoginLimiter.isBlocked(rateLimitKey)) {
        call.respondError(HttpStatusCode.TooManyRequests, "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.")
        return@post
      }

      val session = authRepository.createSession(username, password)
      if (session == null) {
        passwordLoginLimiter.recordFailure(rateLimitKey)
        call.respondError(HttpStatusCode.Unauthorized, "username or password is incorrect")
        return@post
      }

      passwordLoginLimiter.recordSuccess(rateLimitKey)
      call.respond(DataResponse(session))
    }

    post("passkey/register-options") {
      val username = authRepository.usernameForToken(call.bearerToken())
      if (username == null) {
        call.respondError(HttpStatusCode.Unauthorized, "authentication required")
        return@post
      }

      val origin = call.webAuthnOrigin(config)
      if (origin == null) {
        call.respondError(HttpStatusCode.Forbidden, "허용되지 않은 로그인 출처입니다.")
        return@post
      }

      val options = webAuthnRepository.beginRegistration(username, origin)
      if (options == null) {
        call.respondError(HttpStatusCode.BadRequest, "Face ID 등록을 시작하지 못했습니다.")
        return@post
      }

      call.respond(DataResponse(options))
    }

    post("passkey/register") {
      val username = authRepository.usernameForToken(call.bearerToken())
      if (username == null) {
        call.respondError(HttpStatusCode.Unauthorized, "authentication required")
        return@post
      }

      val request = call.receive<WebAuthnRegistrationCredential>()
      if (!webAuthnRepository.finishRegistration(username, request)) {
        call.respondError(HttpStatusCode.BadRequest, "Face ID 등록을 완료하지 못했습니다.")
        return@post
      }

      call.respond(DataResponse(mapOf("registered" to true)))
    }

    post("passkey/login-options") {
      if (passkeyLoginLimiter.isBlocked(call.authRateLimitKey("passkey"))) {
        call.respondError(HttpStatusCode.TooManyRequests, "Face ID 로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.")
        return@post
      }

      val origin = call.webAuthnOrigin(config)
      if (origin == null) {
        call.respondError(HttpStatusCode.Forbidden, "허용되지 않은 로그인 출처입니다.")
        return@post
      }

      val options = webAuthnRepository.beginAuthentication(origin)
      if (options == null) {
        call.respondError(HttpStatusCode.BadRequest, "Face ID 로그인을 시작하지 못했습니다.")
        return@post
      }

      call.respond(DataResponse(options))
    }

    post("passkey/login") {
      val rateLimitKey = call.authRateLimitKey("passkey")
      if (passkeyLoginLimiter.isBlocked(rateLimitKey)) {
        call.respondError(HttpStatusCode.TooManyRequests, "Face ID 로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.")
        return@post
      }

      val request = call.receive<WebAuthnAuthenticationCredential>()
      val session = webAuthnRepository.finishAuthentication(request)
      if (session == null) {
        passkeyLoginLimiter.recordFailure(rateLimitKey)
        call.respondError(HttpStatusCode.Unauthorized, "Face ID 인증에 실패했습니다.")
        return@post
      }

      passkeyLoginLimiter.recordSuccess(rateLimitKey)
      call.respond(DataResponse(session))
    }

    post("change-password") {
      if (!call.requireAuth(authRepository)) return@post

      val request = call.receive<AuthChangePasswordRequest>()
      val currentPassword = request.currentPassword?.takeIf(String::isNotBlank)
      val newPassword = request.newPassword?.takeIf(String::isNotBlank)

      if (currentPassword == null || newPassword == null) {
        call.respondError(HttpStatusCode.BadRequest, "currentPassword and newPassword are required")
        return@post
      }

      if (newPassword.length < 4) {
        call.respondError(HttpStatusCode.BadRequest, "newPassword must be at least 4 characters")
        return@post
      }

      val session = authRepository.changePassword(call.bearerToken(), currentPassword, newPassword)
      if (session == null) {
        call.respondError(HttpStatusCode.Unauthorized, "current password is incorrect")
        return@post
      }

      call.respond(DataResponse(session))
    }
  }
}

private fun io.ktor.server.application.ApplicationCall.webAuthnOrigin(config: AppConfig): String? {
  val requestOrigin = request.headers[HttpHeaders.Origin]?.trim()?.trimEnd('/')
  val configuredOrigin = config.publicBaseUrl.ifBlank { config.corsOrigin.toString() }.trim().trimEnd('/')
  val allowedOrigins = listOf(configuredOrigin, config.corsOrigin.toString().trim().trimEnd('/'))
    .filter(String::isNotBlank)
    .toSet()
  val origin = requestOrigin ?: configuredOrigin
  return origin.takeIf { it in allowedOrigins }
}
