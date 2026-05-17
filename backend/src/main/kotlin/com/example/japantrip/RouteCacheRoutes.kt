package com.example.japantrip

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route

fun Route.routeCacheRoutes(repository: RouteCacheRepository) {
  route("/api/route-cache") {
    get("{fromPlaceId}/{toPlaceId}") {
      val fromPlaceId = call.parameters["fromPlaceId"]
      val toPlaceId = call.parameters["toPlaceId"]
      val errors = listOfNotNull(
        validateRouteCacheKey("fromPlaceId", fromPlaceId),
        validateRouteCacheKey("toPlaceId", toPlaceId)
      )

      if (errors.isNotEmpty()) {
        call.respondErrors(HttpStatusCode.BadRequest, errors)
        return@get
      }

      val route = repository.find(fromPlaceId!!, toPlaceId!!)
      if (route == null) {
        call.respondError(HttpStatusCode.NotFound, "route cache not found")
        return@get
      }

      call.respond(DataResponse(route))
    }

    post {
      val request = call.receive<RouteCacheRequest>()
      val errors = request.validate()

      if (errors.isNotEmpty()) {
        call.respondErrors(HttpStatusCode.BadRequest, errors)
        return@post
      }

      val savedRoute = repository.upsert(request.toValues())
      call.respond(DataResponse(savedRoute))
    }
  }
}
