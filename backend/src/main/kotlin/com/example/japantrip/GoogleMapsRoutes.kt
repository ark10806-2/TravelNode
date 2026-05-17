package com.example.japantrip

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.post

fun Route.googleMapsRoutes(
  googleMapsPreviewService: GoogleMapsPreviewService,
  googleMapsListSyncService: GoogleMapsListSyncService,
  authRepository: AuthRepository
) {
  post("/api/google-maps/preview") {
    if (!call.requireAuth(authRepository)) return@post

    val request = call.receive<GoogleMapsPreviewRequest>()

    if (request.googleMapsUrl.isNullOrBlank()) {
      call.respondError(HttpStatusCode.BadRequest, "googleMapsUrl is required")
      return@post
    }

    val categoryError = validateFilters(request.category, null)
    if (categoryError.isNotEmpty()) {
      call.respondErrors(HttpStatusCode.BadRequest, categoryError)
      return@post
    }

    call.respond(DataResponse(googleMapsPreviewService.preview(request)))
  }

  post("/api/google-maps/list-preview") {
    if (!call.requireAuth(authRepository)) return@post

    val request = call.receive<GoogleMapsListPreviewRequest>()

    if (request.googleMapsUrl.isNullOrBlank()) {
      call.respondError(HttpStatusCode.BadRequest, "googleMapsUrl is required")
      return@post
    }

    val response = try {
      googleMapsListSyncService.preview(request)
    } catch (cause: Exception) {
      call.respondError(HttpStatusCode.BadGateway, cause.message ?: "google maps list preview failed")
      return@post
    }

    call.respond(DataResponse(response))
  }

  post("/api/google-maps/sync-list") {
    if (!call.requireAuth(authRepository)) return@post

    val request = call.receive<GoogleMapsListSyncRequest>()

    if (request.googleMapsUrl.isNullOrBlank()) {
      call.respondError(HttpStatusCode.BadRequest, "googleMapsUrl is required")
      return@post
    }

    val response = try {
      googleMapsListSyncService.sync(request)
    } catch (cause: Exception) {
      call.respondError(HttpStatusCode.BadGateway, cause.message ?: "google maps list sync failed")
      return@post
    }

    call.respond(DataResponse(response))
  }
}
