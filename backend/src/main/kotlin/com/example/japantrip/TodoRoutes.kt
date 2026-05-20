package com.example.japantrip

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.put
import io.ktor.server.routing.route

fun Route.todoRoutes(repository: TodoRepository, authRepository: AuthRepository) {
  route("/api/todos") {
    get {
      if (!call.requireAuth(authRepository)) return@get

      call.respond(DataResponse(repository.findAll()))
    }

    put {
      if (!call.requireAuth(authRepository)) return@put

      val request = call.receive<TodoSaveRequest>()
      val errors = request.validate()
      if (errors.isNotEmpty()) {
        call.respondErrors(HttpStatusCode.BadRequest, errors)
        return@put
      }

      call.respond(DataResponse(repository.replaceAll(request)))
    }
  }
}
