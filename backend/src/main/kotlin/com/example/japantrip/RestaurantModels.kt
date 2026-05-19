package com.example.japantrip

import java.time.OffsetDateTime

data class RestaurantResponse(
  val id: String,
  val name: String,
  val category: String,
  val cuisine: String,
  val menu: String,
  val description: String,
  val googleMapsNote: String?,
  val address: String,
  val googleMapsUrl: String,
  val latitude: Double,
  val longitude: Double,
  val travelMode: String,
  val travelMinutes: Int,
  val distanceLabel: String,
  val createdAt: OffsetDateTime,
  val updatedAt: OffsetDateTime
)

data class RestaurantRequest(
  val name: String? = null,
  val category: String? = null,
  val cuisine: String? = null,
  val menu: String? = null,
  val description: String? = null,
  val googleMapsNote: String? = null,
  val address: String? = null,
  val googleMapsUrl: String? = null,
  val latitude: Double? = null,
  val longitude: Double? = null,
  val travelMode: String? = null,
  val travelMinutes: Int? = null,
  val distanceLabel: String? = null
)

data class RestaurantDescriptionRequest(
  val description: String? = null
)

data class RestaurantPhotoResponse(
  val url: String,
  val widthPx: Int?,
  val heightPx: Int?,
  val authorName: String?,
  val authorUri: String?
)

data class RestaurantPhotoValues(
  val sourcePhotoName: String,
  val contentType: String,
  val imageBytes: ByteArray,
  val widthPx: Int?,
  val heightPx: Int?,
  val authorName: String?,
  val authorUri: String?
)

data class RestaurantValues(
  val name: String,
  val category: String,
  val cuisine: String,
  val menu: String,
  val description: String,
  val googleMapsNote: String?,
  val address: String,
  val googleMapsUrl: String,
  val latitude: Double,
  val longitude: Double,
  val travelMode: String,
  val travelMinutes: Int,
  val distanceLabel: String
)

fun RestaurantRequest.validate(): List<String> {
  val errors = mutableListOf<String>()
  val required = mapOf(
    "name" to name,
    "category" to category,
    "cuisine" to cuisine,
    "menu" to menu,
    "description" to description,
    "address" to address,
    "googleMapsUrl" to googleMapsUrl,
    "travelMode" to travelMode,
    "distanceLabel" to distanceLabel
  )

  required.forEach { (field, value) ->
    if (value.isNullOrBlank()) errors += "$field is required"
  }

  if (category != null && category.isBlank()) errors += "category must not be blank"
  if (travelMode != null && travelMode !in allowedTravelModes) errors += "travelMode must be walk or transit"
  if (latitude == null) errors += "latitude is required"
  if (longitude == null) errors += "longitude is required"
  if (travelMinutes == null || travelMinutes < 0) errors += "travelMinutes must be a non-negative integer"

  return errors
}

fun RestaurantRequest.toValues() = RestaurantValues(
  name = name!!.trim(),
  category = category!!.trim(),
  cuisine = cuisine!!.trim(),
  menu = menu!!.trim(),
  description = description!!.trim(),
  googleMapsNote = googleMapsNote?.trim()?.takeIf { it.isNotBlank() },
  address = address!!.trim(),
  googleMapsUrl = googleMapsUrl!!.trim(),
  latitude = latitude!!,
  longitude = longitude!!,
  travelMode = travelMode!!.trim(),
  travelMinutes = travelMinutes!!,
  distanceLabel = distanceLabel!!.trim()
)

fun RestaurantDescriptionRequest.validate(): List<String> {
  return if (description.isNullOrBlank()) listOf("description is required") else emptyList()
}
