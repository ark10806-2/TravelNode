package com.example.japantrip

data class RouteModeLegResponse(
  val status: String,
  val durationLabel: String,
  val distanceLabel: String,
  val error: String? = null
)

data class RouteLegResponse(
  val driving: RouteModeLegResponse,
  val transit: RouteModeLegResponse,
  val walking: RouteModeLegResponse
)

data class RouteModeLegRequest(
  val status: String? = null,
  val durationLabel: String? = null,
  val distanceLabel: String? = null,
  val error: String? = null
)

data class RouteCacheRequest(
  val fromPlaceId: String? = null,
  val toPlaceId: String? = null,
  val driving: RouteModeLegRequest? = null,
  val transit: RouteModeLegRequest? = null,
  val walking: RouteModeLegRequest? = null
)

data class RouteCacheValues(
  val fromPlaceId: String,
  val toPlaceId: String,
  val driving: RouteModeLegValues,
  val transit: RouteModeLegValues,
  val walking: RouteModeLegValues
)

data class RouteModeLegValues(
  val status: String,
  val durationLabel: String,
  val distanceLabel: String,
  val error: String?
)

fun RouteCacheRequest.validate(): List<String> {
  val errors = mutableListOf<String>()
  val fromIdError = validateRouteCacheKey("fromPlaceId", fromPlaceId)
  val toIdError = validateRouteCacheKey("toPlaceId", toPlaceId)
  if (fromIdError != null) errors += fromIdError
  if (toIdError != null) errors += toIdError
  if (fromPlaceId != null && toPlaceId != null && fromPlaceId == toPlaceId) {
    errors += "fromPlaceId and toPlaceId must be different"
  }

  listOf(
    "driving" to driving,
    "transit" to transit,
    "walking" to walking
  ).forEach { (mode, leg) ->
    if (leg == null) {
      errors += "$mode is required"
      return@forEach
    }

    if (leg.status !in allowedRouteLegStatuses) errors += "$mode.status must be ready, estimated, or error"
    if (leg.durationLabel.isNullOrBlank()) errors += "$mode.durationLabel is required"
    if (leg.distanceLabel.isNullOrBlank()) errors += "$mode.distanceLabel is required"
  }

  return errors
}

fun RouteCacheRequest.toValues() = RouteCacheValues(
  fromPlaceId = fromPlaceId!!.trim(),
  toPlaceId = toPlaceId!!.trim(),
  driving = driving!!.toValues(),
  transit = transit!!.toValues(),
  walking = walking!!.toValues()
)

private fun RouteModeLegRequest.toValues() = RouteModeLegValues(
  status = status!!.trim(),
  durationLabel = durationLabel!!.trim(),
  distanceLabel = distanceLabel!!.trim(),
  error = error?.trim()?.takeIf { it.isNotBlank() }
)

fun validateRouteCacheKey(field: String, value: String?): String? {
  val trimmed = value?.trim()
  return when {
    trimmed.isNullOrBlank() -> "$field is required"
    trimmed.length > 160 || !trimmed.matches(RouteCacheKeyPattern) -> "$field is invalid"
    else -> null
  }
}

private val RouteCacheKeyPattern = Regex("^[A-Za-z0-9:_-]+$")
