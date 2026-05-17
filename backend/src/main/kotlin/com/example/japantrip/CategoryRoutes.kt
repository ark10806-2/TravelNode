package com.example.japantrip

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route

fun Route.categoryRoutes(categoryRepository: CategoryRepository, authRepository: AuthRepository) {
  route("/api/categories") {
    get {
      call.respond(DataResponse(categoryRepository.findAll()))
    }

    post {
      if (!call.requireAuth(authRepository)) return@post

      val request = call.receive<CategoryRequest>()
      val errors = request.validate()
      if (errors.isNotEmpty()) {
        call.respondErrors(HttpStatusCode.BadRequest, errors)
        return@post
      }

      call.respond(HttpStatusCode.Created, DataResponse(categoryRepository.create(request)))
    }

    delete("{id}") {
      if (!call.requireAuth(authRepository)) return@delete

      val id = call.parameters["id"]
      if (id.isNullOrBlank()) {
        call.respondError(HttpStatusCode.BadRequest, "id is required")
        return@delete
      }

      when (categoryRepository.delete(id)) {
        CategoryDeleteResult.Deleted -> call.respond(HttpStatusCode.NoContent)
        CategoryDeleteResult.NotFound -> call.respondError(HttpStatusCode.NotFound, "category not found")
        CategoryDeleteResult.InUse -> call.respondError(HttpStatusCode.Conflict, "category is used by places")
        CategoryDeleteResult.DefaultCategory -> call.respondError(HttpStatusCode.Conflict, "default category cannot be deleted")
      }
    }
  }
}
