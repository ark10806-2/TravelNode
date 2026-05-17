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
      if (!call.requireAuth(authRepository)) return@get
      call.respond(DataResponse(mapOf("authenticated" to true)))
    }

    post("login") {
      val request = call.receive<AuthLoginRequest>()
      val password = request.password?.takeIf(String::isNotBlank)
      if (password == null) {
        call.respondError(HttpStatusCode.BadRequest, "password is required")
        return@post
      }

      val session = authRepository.createSession(password)
      if (session == null) {
        call.respondError(HttpStatusCode.Unauthorized, "password is incorrect")
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

      val session = authRepository.changePassword(currentPassword, newPassword)
      if (session == null) {
        call.respondError(HttpStatusCode.Unauthorized, "current password is incorrect")
        return@post
      }

      call.respond(DataResponse(session))
    }
  }
}
