package com.example.japantrip

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration

class GoogleMapsPhotoService(
  private val apiKey: String? = System.getenv("GOOGLE_MAPS_API_KEY"),
  private val referer: String = System.getenv("APP_CORS_ORIGIN") ?: "http://localhost:5173",
  private val apiUsageRepository: ApiUsageRepository? = null
) {
  private val httpClient = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(8))
    .followRedirects(HttpClient.Redirect.ALWAYS)
    .build()
  private val mapper = jacksonObjectMapper()

  fun photosFor(restaurant: RestaurantResponse, limit: Int = 6): List<RestaurantPhotoValues> {
    val key = apiKey?.takeIf { it.isNotBlank() } ?: return emptyList()
    val photoRefs = searchPhotoRefs(restaurant, key).take(limit)

    return photoRefs.mapNotNull { photo ->
      val photoUri = fetchPhotoUri(photo.name, key) ?: return@mapNotNull null
      val downloaded = downloadPhoto(photoUri) ?: return@mapNotNull null
      RestaurantPhotoValues(
        sourcePhotoName = photo.name,
        contentType = downloaded.contentType,
        imageBytes = downloaded.bytes,
        widthPx = photo.widthPx,
        heightPx = photo.heightPx,
        authorName = photo.authorName,
        authorUri = photo.authorUri
      )
    }
  }

  private fun searchPhotoRefs(restaurant: RestaurantResponse, key: String): List<PlacePhotoRef> {
    val body = mapper.writeValueAsString(
      mapOf(
        "textQuery" to listOf(restaurant.name, restaurant.address).joinToString(" "),
        "languageCode" to "ko",
        "locationBias" to mapOf(
          "circle" to mapOf(
            "center" to mapOf(
              "latitude" to restaurant.latitude,
              "longitude" to restaurant.longitude
            ),
            "radius" to 500.0
          )
        )
      )
    )
    val request = HttpRequest.newBuilder(URI("https://places.googleapis.com/v1/places:searchText"))
      .timeout(Duration.ofSeconds(10))
      .header("Content-Type", "application/json")
      .header("Referer", referer)
      .header("X-Goog-Api-Key", key)
      .header("X-Goog-FieldMask", "places.photos")
      .POST(HttpRequest.BodyPublishers.ofString(body))
      .build()

    val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
    if (response.statusCode() !in 200..299) error("Places photo search failed: ${response.statusCode()}")
    apiUsageRepository?.increment(ApiUsageServiceIds.PlacesNew)

    return mapper.readTree(response.body())
      .path("places")
      .firstOrNull()
      ?.path("photos")
      ?.mapNotNull { it.toPlacePhotoRef() }
      .orEmpty()
  }

  private fun fetchPhotoUri(photoName: String, key: String): String? {
    val encodedName = photoName.split("/")
      .joinToString("/") { URLEncoder.encode(it, StandardCharsets.UTF_8) }
    val request = HttpRequest.newBuilder(
      URI("https://places.googleapis.com/v1/$encodedName/media?maxWidthPx=1200&maxHeightPx=900&skipHttpRedirect=true&key=$key")
    )
      .timeout(Duration.ofSeconds(10))
      .header("Referer", referer)
      .GET()
      .build()

    val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
    if (response.statusCode() !in 200..299) return null
    apiUsageRepository?.increment(ApiUsageServiceIds.PlacesPhoto)

    return mapper.readTree(response.body()).path("photoUri").asText(null)
  }

  private fun downloadPhoto(photoUri: String): DownloadedPhoto? {
    val response = httpClient.send(
      HttpRequest.newBuilder(URI(photoUri))
        .timeout(Duration.ofSeconds(12))
        .GET()
        .build(),
      HttpResponse.BodyHandlers.ofByteArray()
    )
    if (response.statusCode() !in 200..299 || response.body().isEmpty()) return null

    return DownloadedPhoto(
      bytes = response.body(),
      contentType = response.headers().firstValue("content-type").orElse("image/jpeg").substringBefore(";")
    )
  }

  private fun JsonNode.toPlacePhotoRef(): PlacePhotoRef? {
    val name = path("name").asText(null) ?: return null
    val firstAuthor = path("authorAttributions").firstOrNull()

    return PlacePhotoRef(
      name = name,
      widthPx = path("widthPx").takeIf { it.isNumber }?.asInt(),
      heightPx = path("heightPx").takeIf { it.isNumber }?.asInt(),
      authorName = firstAuthor?.path("displayName")?.asText(null),
      authorUri = firstAuthor?.path("uri")?.asText(null)
    )
  }

  private data class PlacePhotoRef(
    val name: String,
    val widthPx: Int?,
    val heightPx: Int?,
    val authorName: String?,
    val authorUri: String?
  )

  private data class DownloadedPhoto(
    val bytes: ByteArray,
    val contentType: String
  )
}
