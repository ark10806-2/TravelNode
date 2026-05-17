package com.example.japantrip

import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.header
import io.ktor.server.response.respondBytes
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import org.slf4j.Logger

fun Route.restaurantRoutes(
  repository: RestaurantRepository,
  photoRepository: RestaurantPhotoRepository,
  googleMapsPhotoService: GoogleMapsPhotoService,
  authRepository: AuthRepository,
  publicBaseUrl: String,
  appLog: Logger
) {
  route("/api/restaurants") {
    get {
      val category = call.request.queryParameters["category"]
      val travelMode = call.request.queryParameters["travelMode"]
      val errors = validateFilters(category, travelMode)

      if (errors.isNotEmpty()) {
        call.respondErrors(HttpStatusCode.BadRequest, errors)
        return@get
      }

      call.respond(DataResponse(repository.findAll(category, travelMode)))
    }

    post {
      if (!call.requireAuth(authRepository)) return@post

      val request = call.receive<RestaurantRequest>()
      val errors = request.validate()

      if (errors.isNotEmpty()) {
        call.respondErrors(HttpStatusCode.BadRequest, errors)
        return@post
      }

      call.respond(HttpStatusCode.Created, DataResponse(repository.create(request.toValues())))
    }

    put("{id}") {
      if (!call.requireAuth(authRepository)) return@put

      val id = call.parameters["id"]
      val idError = validateUuid(id)
      if (idError != null) {
        call.respondError(HttpStatusCode.BadRequest, idError)
        return@put
      }

      val request = call.receive<RestaurantRequest>()
      val errors = request.validate()

      if (errors.isNotEmpty()) {
        call.respondErrors(HttpStatusCode.BadRequest, errors)
        return@put
      }

      val updated = repository.update(id!!, request.toValues())
      if (updated == null) {
        call.respondError(HttpStatusCode.NotFound, "restaurant not found")
        return@put
      }

      call.respond(DataResponse(updated))
    }

    patch("{id}/description") {
      if (!call.requireAuth(authRepository)) return@patch

      val id = call.parameters["id"]
      val idError = validateUuid(id)
      if (idError != null) {
        call.respondError(HttpStatusCode.BadRequest, idError)
        return@patch
      }

      val request = call.receive<RestaurantDescriptionRequest>()
      val errors = request.validate()
      if (errors.isNotEmpty()) {
        call.respondErrors(HttpStatusCode.BadRequest, errors)
        return@patch
      }

      val updated = repository.updateDescription(id!!, request.description!!)
      if (updated == null) {
        call.respondError(HttpStatusCode.NotFound, "restaurant not found")
        return@patch
      }

      call.respond(DataResponse(updated))
    }

    get("{id}/photos") {
      val id = call.parameters["id"]
      val idError = validateUuid(id)
      if (idError != null) {
        call.respondError(HttpStatusCode.BadRequest, idError)
        return@get
      }

      val restaurant = repository.findById(id!!)
      if (restaurant == null) {
        call.respondError(HttpStatusCode.NotFound, "restaurant not found")
        return@get
      }

      val cachedPhotos = photoRepository.findByRestaurantId(restaurant.id)
      if (cachedPhotos.isNotEmpty()) {
        call.respond(DataResponse(cachedPhotos.map { it.toResponse(publicBaseUrl) }))
        return@get
      }

      if (photoRepository.isCacheFresh(restaurant.id)) {
        call.respond(DataResponse(emptyList<RestaurantPhotoResponse>()))
        return@get
      }

      val photos = try {
        val downloadedPhotos = googleMapsPhotoService.photosFor(restaurant)
        photoRepository.replaceForRestaurant(restaurant.id, downloadedPhotos)
      } catch (cause: Exception) {
        appLog.warn("Failed to load restaurant photos for ${restaurant.id}", cause)
        call.respondError(HttpStatusCode.BadGateway, "restaurant photos could not be loaded from Google Places")
        return@get
      }

      call.respond(DataResponse(photos.map { it.toResponse(publicBaseUrl) }))
    }

    get("{id}/photos/{photoId}/image") {
      val id = call.parameters["id"]
      val photoId = call.parameters["photoId"]
      val idError = validateUuid(id)
      val photoIdError = validateUuid(photoId)
      val errors = listOfNotNull(idError, photoIdError)
      if (errors.isNotEmpty()) {
        call.respondErrors(HttpStatusCode.BadRequest, errors)
        return@get
      }

      val photo = photoRepository.findImage(id!!, photoId!!)
      if (photo == null) {
        call.respondError(HttpStatusCode.NotFound, "restaurant photo not found")
        return@get
      }

      call.response.header(HttpHeaders.CacheControl, "public, max-age=31536000, immutable")
      call.respondBytes(photo.imageBytes, ContentType.parse(photo.contentType))
    }

    delete("{id}") {
      if (!call.requireAuth(authRepository)) return@delete

      val id = call.parameters["id"]
      val idError = validateUuid(id)
      if (idError != null) {
        call.respondError(HttpStatusCode.BadRequest, idError)
        return@delete
      }

      if (!repository.delete(id!!)) {
        call.respondError(HttpStatusCode.NotFound, "restaurant not found")
        return@delete
      }

      call.respond(HttpStatusCode.NoContent)
    }
  }
}
