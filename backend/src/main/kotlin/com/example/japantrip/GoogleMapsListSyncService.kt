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

class GoogleMapsListSyncService(
  private val restaurantRepository: RestaurantRepository,
  private val apiKey: String? = System.getenv("GOOGLE_MAPS_API_KEY"),
  private val referer: String = System.getenv("APP_CORS_ORIGIN") ?: "http://localhost:5173",
  private val apiUsageRepository: ApiUsageRepository? = null
) {
  private val httpClient = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(8))
    .followRedirects(HttpClient.Redirect.ALWAYS)
    .build()
  private val mapper = jacksonObjectMapper()

  fun preview(request: GoogleMapsListPreviewRequest): GoogleMapsListPreviewResponse {
    val warnings = mutableListOf<String>()
    val parsed = readList(request.googleMapsUrl, warnings)
    val places = parsed.restaurants.map { it.toPreviewPlace(loadThumbnailUrl(it)) }

    if (parsed.failedCount > 0) {
      warnings += "목록 항목 ${parsed.failedCount}개는 이름이나 좌표가 없어 건너뛰었습니다."
    }

    if (apiKey.isNullOrBlank()) {
      warnings += "GOOGLE_MAPS_API_KEY가 없어 장소 사진 없이 목록만 표시합니다."
    }

    return GoogleMapsListPreviewResponse(
      listTitle = parsed.listTitle,
      resolvedUrl = parsed.resolvedUrl,
      requestedCount = parsed.requestedCount,
      failedCount = parsed.failedCount,
      places = places,
      warnings = warnings.distinct()
    )
  }

  fun sync(request: GoogleMapsListSyncRequest): GoogleMapsListSyncResponse {
    val warnings = mutableListOf<String>()
    val parsed = readList(request.googleMapsUrl, warnings)
    val selectedSyncKeys = request.selectedSyncKeys
      ?.map(String::trim)
      ?.filter(String::isNotBlank)
      ?.toSet()
    val importTargets = selectedSyncKeys?.let { keys ->
      parsed.restaurants.filter { it.syncKey in keys }
    } ?: parsed.restaurants
    val importResult = restaurantRepository.importSynced(importTargets)

    if (parsed.failedCount > 0) {
      warnings += "목록 항목 ${parsed.failedCount}개는 이름이나 좌표가 없어 건너뛰었습니다."
    }

    return GoogleMapsListSyncResponse(
      listTitle = parsed.listTitle,
      resolvedUrl = parsed.resolvedUrl,
      requestedCount = parsed.requestedCount,
      createdCount = importResult.created.size,
      skippedExistingCount = importResult.skippedExistingCount,
      skippedDeletedCount = importResult.skippedDeletedCount,
      failedCount = parsed.failedCount,
      created = importResult.created,
      warnings = warnings.distinct()
    )
  }

  private fun readList(url: String?, warnings: MutableList<String>): ParsedList {
    val originalUrl = url?.trim().orEmpty()
    require(originalUrl.isNotBlank()) { "googleMapsUrl is required" }

    googleMapsUrlCandidates(originalUrl).forEach { candidateUrl ->
      val resolvedUrl = resolveRedirectUrl(candidateUrl)
      val listEndpoint = resolvedUrl?.let(::buildListEndpointFromResolvedUrl)
      if (resolvedUrl != null && listEndpoint != null) {
        return parseList(fetchListBody(listEndpoint), resolvedUrl, warnings)
      }
    }

    googleMapsUrlCandidates(originalUrl).forEach { candidateUrl ->
      val listPage = fetchGoogleMapsPage(candidateUrl)
      val listEndpoint = extractListEndpoint(listPage.body)
        ?: buildListEndpointFromResolvedUrl(listPage.resolvedUrl)
      if (listEndpoint != null) {
        return parseList(fetchListBody(listEndpoint), listPage.resolvedUrl, warnings)
      }
    }

    error("Google Maps 즐겨찾기 목록 주소를 찾지 못했습니다.")
  }

  private fun resolveRedirectUrl(url: String): String? {
    return try {
      val response = httpClient.send(
        baseRequest(URI(url))
          .method("HEAD", HttpRequest.BodyPublishers.noBody())
          .build(),
        HttpResponse.BodyHandlers.discarding()
      )
      response.uri().toString().takeIf { it != url }
        ?: response.headers().firstValue("location").orElse(null)?.let { location ->
          URI(url).resolve(location).toString()
        }
    } catch (_: Exception) {
      null
    }
  }

  private fun fetchGoogleMapsPage(url: String): FetchedPage {
    val response = httpClient.send(
      baseRequest(URI(url))
        .GET()
        .build(),
      HttpResponse.BodyHandlers.ofString()
    )

    if (response.statusCode() !in 200..299) {
      error("Google Maps 목록 페이지를 불러오지 못했습니다. status=${response.statusCode()}")
    }

    return FetchedPage(response.uri().toString(), response.body())
  }

  private fun fetchListBody(endpoint: String): String {
    val response = httpClient.send(
      baseRequest(URI(endpoint))
        .GET()
        .build(),
      HttpResponse.BodyHandlers.ofString()
    )

    if (response.statusCode() !in 200..299) {
      error("Google Maps 목록 데이터를 불러오지 못했습니다. status=${response.statusCode()}")
    }

    return response.body()
  }

  private fun baseRequest(uri: URI) = HttpRequest.newBuilder(uri)
    .timeout(Duration.ofSeconds(12))
    .header("User-Agent", BrowserUserAgent)
    .header("Accept-Language", "ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6")

  private fun extractListEndpoint(html: String): String? {
    val rawUrl = Regex("""href="([^"]*/maps/preview/entitylist/getlist\?[^"]+)""")
      .find(html)
      ?.groupValues
      ?.getOrNull(1)
      ?.decodeHtmlAttribute()

    return rawUrl?.let {
      if (it.startsWith("http")) it else "https://www.google.com$it"
    }
  }

  private fun buildListEndpointFromResolvedUrl(resolvedUrl: String): String? {
    val decoded = URLDecoder.decode(resolvedUrl, StandardCharsets.UTF_8)
    val listId = Regex("""!11m2!2s([^!]+)!3e3""")
      .find(decoded)
      ?.groupValues
      ?.getOrNull(1)
      ?.takeIf { it.isNotBlank() }
      ?: return null
    val pb = URLEncoder.encode("!1m4!1s$listId!2e1!3m1!1e1!2e2!3e2!4i500", StandardCharsets.UTF_8)
    return "https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=ko&gl=kr&pb=$pb"
  }

  private fun googleMapsUrlCandidates(url: String): List<String> {
    val uri = runCatching { URI(url) }.getOrNull()
    if (uri?.host != "maps.app.goo.gl") return listOf(url)

    val separator = if (url.contains("?")) "&" else "?"
    return listOf(
      url,
      "$url${separator}_imcp=1",
      "$url${separator}_iipp=1"
    ).distinct()
  }

  private fun parseList(body: String, sourceUrl: String, warnings: MutableList<String>): ParsedList {
    val jsonText = body.removePrefix(")]}'").trimStart()
    val root = mapper.readTree(jsonText)
    val listNode = root.path(0)
    val listTitle = listNode.path(4).asText(null)
    val entries = listNode.path(8)

    if (!entries.isArray) {
      error("Google Maps 목록 데이터 형식이 예상과 다릅니다.")
    }

    val restaurants = mutableListOf<GoogleMapsSyncedRestaurantValues>()
    var failedCount = 0

    entries.forEachIndexed { index, entry ->
      val values = entry.toSyncedRestaurant(sourceUrl, listTitle, index, warnings)
      if (values == null) failedCount += 1 else restaurants += values
    }

    return ParsedList(
      listTitle = listTitle,
      resolvedUrl = sourceUrl,
      requestedCount = entries.size(),
      failedCount = failedCount,
      restaurants = restaurants
    )
  }

  private fun JsonNode.toSyncedRestaurant(
    sourceUrl: String,
    listTitle: String?,
    index: Int,
    warnings: MutableList<String>
  ): GoogleMapsSyncedRestaurantValues? {
    val placeNode = path(1)
    val name = path(2).asTrimmedText()
      ?: placeNode.path(2).asTrimmedText()
      ?: return null
    val note = path(3).asTrimmedText().orEmpty()
    val address = placeNode.path(4).asTrimmedText()
      ?: placeNode.path(2).asTrimmedText()
      ?: ""
    val location = placeNode.path(5)
    val latitude = location.path(2).asNullableDouble() ?: return null
    val longitude = location.path(3).asNullableDouble() ?: return null
    val syncKey = buildSyncKey(placeNode, name, latitude, longitude)
    val category = inferCategory(name, note)
    val cuisine = inferCuisine(name, category)
    val menu = inferMenu(name, note, category)
    val distanceKm = haversineKm(HotelLocation, Coordinate(latitude, longitude))
    val travelMode = if (distanceKm <= 2.0) "walk" else "transit"

    if (syncKey.endsWith(":$index")) {
      warnings += "$name 항목은 Google 내부 키가 없어 이름과 좌표 기반으로 동기화합니다."
    }

    return GoogleMapsSyncedRestaurantValues(
      restaurant = RestaurantValues(
        name = name,
        category = category,
        cuisine = cuisine,
        menu = menu,
        description = buildDescription(name, note, listTitle),
        address = address.ifBlank { "주소 확인 필요" },
        googleMapsUrl = buildPlaceSearchUrl(name, address),
        latitude = latitude,
        longitude = longitude,
        travelMode = travelMode,
        travelMinutes = estimateTravelMinutes(distanceKm, travelMode),
        distanceLabel = if (distanceKm < 1) "${(distanceKm * 1000).toInt()}m" else "%.1fkm".format(distanceKm),
        noSeafood = !containsSeafoodKeyword(name)
      ),
      syncKey = syncKey,
      sourceUrl = sourceUrl,
      listTitle = listTitle
    )
  }

  private fun buildSyncKey(placeNode: JsonNode, name: String, latitude: Double, longitude: Double): String {
    val canonicalId = placeNode.path(7).asTrimmedText()
    if (canonicalId != null) return "google-maps-list:$canonicalId"

    val internalIds = placeNode.path(6)
      .takeIf { it.isArray }
      ?.mapNotNull { it.asTrimmedText() }
      ?.takeIf { it.isNotEmpty() }
      ?.joinToString(":")
    if (internalIds != null) return "google-maps-list:$internalIds"

    return "google-maps-list:${name.lowercase()}:${"%.6f".format(latitude)}:${"%.6f".format(longitude)}"
  }

  private fun inferCategory(name: String, note: String): String {
    val text = "$name $note".lowercase()
    return when {
      DessertKeywords.any { it in text } -> "dessert"
      SightseeingKeywords.any { it in text } -> "sightseeing"
      else -> "meal"
    }
  }

  private fun inferCuisine(name: String, category: String): String {
    val text = name.lowercase()
    return when {
      category == "dessert" -> "디저트 / 카페"
      category == "sightseeing" -> "관광 / 쇼핑"
      "우동" in text || "うどん" in text -> "우동"
      "라멘" in text || "ramen" in text -> "라멘"
      "돈카츠" in text || "とんかつ" in text || "카츠" in text -> "돈카츠"
      "야키니쿠" in text || "焼肉" in text || "chikamitsu" in text -> "야키니쿠"
      "샤부" in text || "しゃぶ" in text -> "샤부샤부"
      "호르몬" in text || "horumon" in text -> "호르몬야키"
      "몬자" in text -> "몬자야키"
      "맥주" in text || "bar" in text -> "바 / 맥주"
      else -> "음식점"
    }
  }

  private fun inferMenu(name: String, note: String, category: String): String {
    if (note.isNotBlank()) return note

    val text = name.lowercase()
    return when {
      category == "dessert" -> "대표 디저트 / 음료"
      category == "sightseeing" -> "방문 후보"
      "우동" in text || "うどん" in text -> "우동"
      "라멘" in text || "ramen" in text -> "라멘"
      "돈카츠" in text || "とんかつ" in text || "카츠" in text -> "돈카츠"
      "야키니쿠" in text || "焼肉" in text || "chikamitsu" in text -> "야키니쿠"
      "샤부" in text || "しゃぶ" in text -> "샤부샤부"
      "호르몬" in text || "horumon" in text -> "호르몬야키"
      "몬자" in text -> "몬자야키"
      "맥주" in text || "bar" in text -> "맥주 / 음료"
      else -> "대표 메뉴 확인 필요"
    }
  }

  private fun buildDescription(name: String, note: String, listTitle: String?): String {
    val prefix = listTitle?.takeIf { it.isNotBlank() }?.let { "$it 목록" } ?: "Google Maps 즐겨찾기"
    val memo = note.takeIf { it.isNotBlank() }?.let { " 저장된 메모: $it" }.orEmpty()
    return "${name}은 ${prefix}에서 가져온 장소입니다.$memo 방문 전 영업시간과 휴무일을 확인해주세요."
  }

  private fun containsSeafoodKeyword(name: String): Boolean {
    val text = name.lowercase()
    return SeafoodKeywords.any { it in text }
  }

  private fun estimateTravelMinutes(distanceKm: Double, travelMode: String): Int {
    return if (travelMode == "walk") {
      ceil(distanceKm / 0.08).toInt().coerceAtLeast(1)
    } else {
      ceil(distanceKm * 3 + 12).toInt().coerceIn(15, 60)
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

  private fun buildPlaceSearchUrl(name: String, address: String): String {
    val query = listOf(name, address)
      .filter { it.isNotBlank() }
      .joinToString(" ")
    val encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8)
    return "https://www.google.com/maps/search/?api=1&query=$encodedQuery"
  }

  private fun loadThumbnailUrl(values: GoogleMapsSyncedRestaurantValues): String? {
    val key = apiKey?.takeIf { it.isNotBlank() } ?: return null
    val restaurant = values.restaurant
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

    val photoName = try {
      val request = HttpRequest.newBuilder(URI("https://places.googleapis.com/v1/places:searchText"))
        .timeout(Duration.ofSeconds(8))
        .header("Content-Type", "application/json")
        .header("Referer", referer)
        .header("X-Goog-Api-Key", key)
        .header("X-Goog-FieldMask", "places.photos")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build()
      val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
      if (response.statusCode() !in 200..299) return null
      apiUsageRepository?.increment(ApiUsageServiceIds.PlacesNew)
      mapper.readTree(response.body())
        .path("places")
        .firstOrNull()
        ?.path("photos")
        ?.firstOrNull()
        ?.path("name")
        ?.asText(null)
        ?: return null
    } catch (_: Exception) {
      return null
    }

    return try {
      val encodedName = photoName.split("/")
        .joinToString("/") { URLEncoder.encode(it, StandardCharsets.UTF_8) }
      val request = HttpRequest.newBuilder(
        URI("https://places.googleapis.com/v1/$encodedName/media?maxWidthPx=240&maxHeightPx=180&skipHttpRedirect=true&key=$key")
      )
        .timeout(Duration.ofSeconds(8))
        .header("Referer", referer)
        .GET()
        .build()
      val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
      if (response.statusCode() !in 200..299) return null
      apiUsageRepository?.increment(ApiUsageServiceIds.PlacesPhoto)
      mapper.readTree(response.body()).path("photoUri").asText(null)
    } catch (_: Exception) {
      null
    }
  }

  private fun GoogleMapsSyncedRestaurantValues.toPreviewPlace(thumbnailUrl: String?) = GoogleMapsListPreviewPlace(
    syncKey = syncKey,
    name = restaurant.name,
    category = restaurant.category,
    cuisine = restaurant.cuisine,
    menu = restaurant.menu,
    description = restaurant.description,
    address = restaurant.address,
    googleMapsUrl = restaurant.googleMapsUrl,
    latitude = restaurant.latitude,
    longitude = restaurant.longitude,
    travelMode = restaurant.travelMode,
    travelMinutes = restaurant.travelMinutes,
    distanceLabel = restaurant.distanceLabel,
    noSeafood = restaurant.noSeafood,
    thumbnailUrl = thumbnailUrl
  )

  private fun String.decodeHtmlAttribute() = replace("&amp;", "&")
    .replace("\\u003d", "=")
    .replace("\\u0026", "&")

  private fun JsonNode.asTrimmedText(): String? = asText(null)?.trim()?.takeIf { it.isNotBlank() }

  private fun JsonNode.asNullableDouble(): Double? = if (isNumber) asDouble() else null

  private data class Coordinate(val latitude: Double, val longitude: Double)

  private data class FetchedPage(val resolvedUrl: String, val body: String)

  private data class ParsedList(
    val listTitle: String?,
    val resolvedUrl: String?,
    val requestedCount: Int,
    val failedCount: Int,
    val restaurants: List<GoogleMapsSyncedRestaurantValues>
  )

  private companion object {
    val HotelLocation = Coordinate(35.668862, 139.773098)
    const val BrowserUserAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
    val DessertKeywords = listOf(
      "cafe",
      "카페",
      "커피",
      "coffee",
      "초콜릿",
      "chocolate",
      "하브스",
      "harbs",
      "크레페",
      "クレープ",
      "espresso",
      "에스프레ッソ",
      "パン",
      "팡 ",
      "bakery",
      "bread",
      "cha "
    )
    val SightseeingKeywords = listOf(
      "museum",
      "뮤지엄",
      "미술관",
      "박물관",
      "aquarium",
      "아쿠아리움",
      "디즈니",
      "disney",
      "루미네",
      "lumine",
      "bshop",
      "도버 스트리트",
      "market",
      "쇼핑",
      "호텔"
    )
    val SeafoodKeywords = listOf(
      "스시",
      "sushi",
      "초밥",
      "장어",
      "うなぎ",
      "unagi",
      "긴다코",
      "gindaco",
      "문어",
      "타코야키",
      "takoyaki",
      "생선",
      "fish"
    )
  }
}
