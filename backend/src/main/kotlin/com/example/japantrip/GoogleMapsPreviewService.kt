package com.example.japantrip

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

class GoogleMapsPreviewService(
  private val apiKey: String? = System.getenv("GOOGLE_MAPS_API_KEY"),
  private val referer: String = System.getenv("APP_CORS_ORIGIN") ?: "http://localhost:5173",
  private val apiUsageRepository: ApiUsageRepository? = null
) {
  private val httpClient = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(8))
    .followRedirects(HttpClient.Redirect.ALWAYS)
    .build()
  private val mapper = jacksonObjectMapper()

  fun preview(request: GoogleMapsPreviewRequest): GoogleMapsPreviewResponse {
    val originalUrl = request.googleMapsUrl?.trim().orEmpty()
    require(originalUrl.isNotBlank()) { "googleMapsUrl is required" }

    val warnings = mutableListOf<String>()
    val resolvedUrl = resolveUrl(originalUrl, warnings)
    val linkInfo = parseGoogleMapsLink(resolvedUrl ?: originalUrl)
    val place = lookupPlace(linkInfo, warnings)
    val category = normalizeCategory(request.category)
    val location = place?.location ?: linkInfo.location ?: HotelLocation
    val distanceKm = haversineKm(HotelLocation, location)
    val travelMode = if (distanceKm <= 2.0) "walk" else "transit"
    val cuisine = place?.primaryType ?: category.defaultCuisine()
    val name = place?.name ?: linkInfo.query ?: "새 장소"

    if (place == null && apiKey.isNullOrBlank()) {
      warnings += "GOOGLE_MAPS_API_KEY가 없어 링크/좌표만 해석했습니다. Places API 키를 넣으면 이름과 주소를 더 잘 채울 수 있습니다."
    }

    if (place?.primaryType == null) {
      warnings += "Google Places가 대표 항목 정보를 안정적으로 제공하지 않아 대표 항목/설명은 초안으로 채웠습니다."
    }

    return GoogleMapsPreviewResponse(
      restaurant = RestaurantDraft(
        name = name,
        category = category,
        cuisine = cuisine,
        menu = cuisine,
        description = "${name}의 Google Maps 링크에서 가져온 초안입니다. 대표 항목과 설명은 저장 전에 확인해주세요.",
        googleMapsNote = null,
        googlePlaceId = place?.placeId ?: linkInfo.placeId,
        address = place?.address ?: linkInfo.query ?: "주소 확인 필요",
        googleMapsUrl = place?.googleMapsUrl ?: buildPlaceSearchUrl(name, place?.address ?: linkInfo.query, place?.placeId ?: linkInfo.placeId),
        latitude = location.latitude,
        longitude = location.longitude,
        travelMode = travelMode,
        travelMinutes = estimateTravelMinutes(distanceKm, travelMode),
        distanceLabel = if (distanceKm < 1) "${(distanceKm * 1000).toInt()}m" else "%.1fkm".format(distanceKm)
      ),
      resolvedUrl = resolvedUrl,
      warnings = warnings.distinct()
    )
  }

  private fun resolveUrl(url: String, warnings: MutableList<String>): String? {
    if (!url.startsWith("http://") && !url.startsWith("https://")) return null

    return try {
      val request = HttpRequest.newBuilder(URI(url))
        .timeout(Duration.ofSeconds(10))
        .header("User-Agent", "JapanTripRestaurantMap/0.1")
        .GET()
        .build()

      httpClient.send(request, HttpResponse.BodyHandlers.discarding()).uri().toString()
    } catch (_: Exception) {
      warnings += "Google Maps 링크 리다이렉트를 따라가지 못했습니다. 원본 링크에서 가능한 정보만 사용했습니다."
      null
    }
  }

  private fun parseGoogleMapsLink(url: String): LinkInfo {
    val uri = runCatching { URI(url) }.getOrNull()
    val params = uri?.rawQuery?.split("&")
      ?.mapNotNull {
        val parts = it.split("=", limit = 2)
        if (parts.size == 2) decode(parts[0]) to decode(parts[1]) else null
      }
      ?.toMap()
      .orEmpty()

    val pathQuery = uri?.rawPath
      ?.split("/")
      ?.dropWhile { it != "place" }
      ?.drop(1)
      ?.firstOrNull()
      ?.takeIf { it.isNotBlank() }
      ?.let(::decode)
      ?.replace("+", " ")

    return LinkInfo(
      placeId = params["query_place_id"] ?: params["place_id"] ?: params["destination_place_id"],
      query = params["query"] ?: params["q"] ?: params["destination"] ?: pathQuery,
      location = extractLocation(url)
    )
  }

  private fun lookupPlace(linkInfo: LinkInfo, warnings: MutableList<String>): PlaceInfo? {
    if (apiKey.isNullOrBlank()) return null

    return try {
      when {
        linkInfo.placeId != null -> fetchPlaceDetails(linkInfo.placeId)
        linkInfo.query != null -> searchPlace(linkInfo.query, linkInfo.location)
        else -> null
      }
    } catch (_: Exception) {
      warnings += "Places API에서 장소 정보를 가져오지 못했습니다. Maps JavaScript API와 별도로 Places API(New)가 활성화되어 있는지 확인해주세요."
      null
    }
  }

  private fun fetchPlaceDetails(placeId: String): PlaceInfo? {
    val key = apiKey ?: error("GOOGLE_MAPS_API_KEY is required")
    val encodedPlaceId = URLEncoder.encode(placeId, StandardCharsets.UTF_8)
    val request = HttpRequest.newBuilder(URI("https://places.googleapis.com/v1/places/$encodedPlaceId"))
      .timeout(Duration.ofSeconds(10))
      .header("Referer", referer)
      .header("X-Goog-Api-Key", key)
      .header("X-Goog-FieldMask", FieldMask)
      .GET()
      .build()

    val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
    if (response.statusCode() !in 200..299) error("Places details failed: ${response.statusCode()}")
    apiUsageRepository?.increment(ApiUsageServiceIds.PlacesNew)
    return mapper.readTree(response.body()).toPlaceInfo()
  }

  private fun searchPlace(query: String, locationBias: Coordinate?): PlaceInfo? {
    val key = apiKey ?: error("GOOGLE_MAPS_API_KEY is required")
    val requestBody = mutableMapOf<String, Any>(
      "textQuery" to query,
      "languageCode" to "ko"
    )
    if (locationBias != null) {
      requestBody["locationBias"] = mapOf(
        "circle" to mapOf(
          "center" to mapOf(
            "latitude" to locationBias.latitude,
            "longitude" to locationBias.longitude
          ),
          "radius" to 500.0
        )
      )
    }
    val body = mapper.writeValueAsString(requestBody)
    val request = HttpRequest.newBuilder(URI("https://places.googleapis.com/v1/places:searchText"))
      .timeout(Duration.ofSeconds(10))
      .header("Content-Type", "application/json")
      .header("Referer", referer)
      .header("X-Goog-Api-Key", key)
      .header("X-Goog-FieldMask", TextSearchFieldMask)
      .POST(HttpRequest.BodyPublishers.ofString(body))
      .build()

    val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
    if (response.statusCode() !in 200..299) error("Places search failed: ${response.statusCode()}")
    apiUsageRepository?.increment(ApiUsageServiceIds.PlacesNew)
    return mapper.readTree(response.body()).path("places").firstOrNull()?.toPlaceInfo()
  }

  private fun JsonNode.toPlaceInfo(): PlaceInfo? {
    val location = path("location").takeIf { it.has("latitude") && it.has("longitude") }
      ?.let { Coordinate(it.path("latitude").asDouble(), it.path("longitude").asDouble()) }

    return PlaceInfo(
      placeId = path("id").asText(null),
      name = path("displayName").path("text").asText(null),
      address = path("formattedAddress").asText(null),
      primaryType = path("primaryTypeDisplayName").path("text").asText(null),
      googleMapsUrl = buildPlaceSearchUrl(
        path("displayName").path("text").asText(null).orEmpty(),
        path("formattedAddress").asText(null),
        path("id").asText(null)
      ).takeIf { path("id").asText(null) != null } ?: path("googleMapsUri").asText(null),
      location = location
    ).takeIf { it.name != null || it.address != null || it.location != null }
  }

  private fun extractLocation(url: String): Coordinate? {
    val patterns = listOf(
      Regex("""@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)"""),
      Regex("""!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)""")
    )

    return patterns.firstNotNullOfOrNull { pattern ->
      pattern.find(url)?.let { Coordinate(it.groupValues[1].toDouble(), it.groupValues[2].toDouble()) }
    }
  }

  private fun estimateTravelMinutes(distanceKm: Double, travelMode: String): Int {
    return if (travelMode == "walk") {
      ceil(distanceKm / 0.08).toInt().coerceAtLeast(1)
    } else {
      ceil(distanceKm * 3 + 12).toInt().coerceIn(15, 30)
    }
  }

  private fun haversineKm(a: Coordinate, b: Coordinate): Double {
    val radiusKm = 6371.0
    val dLat = Math.toRadians(b.latitude - a.latitude)
    val dLon = Math.toRadians(b.longitude - a.longitude)
    val lat1 = Math.toRadians(a.latitude)
    val lat2 = Math.toRadians(b.latitude)
    val value = sin(dLat / 2) * sin(dLat / 2) + sin(dLon / 2) * sin(dLon / 2) * cos(lat1) * cos(lat2)
    return radiusKm * 2 * atan2(sqrt(value), sqrt(1 - value))
  }

  private fun decode(value: String) = URLDecoder.decode(value, StandardCharsets.UTF_8)

  private fun buildPlaceSearchUrl(name: String, address: String?, placeId: String? = null): String {
    val query = listOf(name, address)
      .mapNotNull { it?.takeIf(String::isNotBlank) }
      .joinToString(" ")
    val encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8)
    val encodedPlaceId = placeId?.takeIf { it.isNotBlank() }?.let { URLEncoder.encode(it, StandardCharsets.UTF_8) }
    return buildString {
      append("https://www.google.com/maps/search/?api=1&query=")
      append(encodedQuery)
      if (encodedPlaceId != null) {
        append("&query_place_id=")
        append(encodedPlaceId)
      }
    }
  }

  private fun String.defaultCuisine() = when (this) {
    "dessert" -> "디저트 카페"
    "sightseeing" -> "관광 명소"
    else -> "음식점"
  }

  private data class Coordinate(val latitude: Double, val longitude: Double)

  private data class LinkInfo(
    val placeId: String?,
    val query: String?,
    val location: Coordinate?
  )

  private data class PlaceInfo(
    val placeId: String?,
    val name: String?,
    val address: String?,
    val primaryType: String?,
    val googleMapsUrl: String?,
    val location: Coordinate?
  )

  private companion object {
    val HotelLocation = Coordinate(35.668862, 139.773098)
    const val FieldMask = "id,displayName,formattedAddress,location,primaryTypeDisplayName,googleMapsUri,types"
    val TextSearchFieldMask = FieldMask.split(",").joinToString(",") { "places.$it" }
  }
}
