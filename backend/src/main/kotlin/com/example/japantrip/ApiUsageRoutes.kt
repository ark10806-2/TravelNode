package com.example.japantrip

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route

fun Route.apiUsageRoutes(repository: ApiUsageRepository, authRepository: AuthRepository) {
  route("/api/api-usage") {
    get {
      call.respond(DataResponse(repository.summary()))
    }

    post("events") {
      val request = call.receive<ApiUsageEventRequest>()
      val errors = listOfNotNull(repository.validateServiceId(request.serviceId))

      if (errors.isNotEmpty()) {
        call.respondErrors(HttpStatusCode.BadRequest, errors)
        return@post
      }

      repository.increment(request.serviceId!!, request.count ?: 1)
      call.respond(HttpStatusCode.Created, DataResponse(repository.summary()))
    }

    patch("{serviceId}") {
      if (!call.requireAuth(authRepository)) return@patch

      val serviceId = call.parameters["serviceId"]
      val request = call.receive<ApiUsageUpdateRequest>()
      val errors = listOfNotNull(repository.validateServiceId(serviceId)) + repository.validateUpdate(request)

      if (errors.isNotEmpty()) {
        call.respondErrors(HttpStatusCode.BadRequest, errors)
        return@patch
      }

      call.respond(DataResponse(repository.update(serviceId!!, request.used!!, request.limit!!)))
    }
  }
}
