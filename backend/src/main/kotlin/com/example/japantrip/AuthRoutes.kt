package com.example.japantrip

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route

fun Route.authRoutes(authRepository: AuthRepository) {
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

      val session = authRepository.createSession(username, password)
      if (session == null) {
        call.respondError(HttpStatusCode.Unauthorized, "username or password is incorrect")
        return@post
      }

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
