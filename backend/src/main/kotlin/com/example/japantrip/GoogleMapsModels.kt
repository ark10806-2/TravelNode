package com.example.japantrip

data class GoogleMapsPreviewRequest(
  val googleMapsUrl: String? = null,
  val category: String? = null
)

data class RestaurantDraft(
  val name: String,
  val category: String,
  val cuisine: String,
  val menu: String,
  val description: String,
  val address: String,
  val googleMapsUrl: String,
  val latitude: Double,
  val longitude: Double,
  val travelMode: String,
  val travelMinutes: Int,
  val distanceLabel: String,
  val noSeafood: Boolean
)

data class GoogleMapsPreviewResponse(
  val restaurant: RestaurantDraft,
  val resolvedUrl: String?,
  val warnings: List<String>
)

data class GoogleMapsListSyncRequest(
  val googleMapsUrl: String? = null,
  val selectedSyncKeys: List<String>? = null
)

data class GoogleMapsListPreviewRequest(
  val googleMapsUrl: String? = null
)

data class GoogleMapsListPreviewResponse(
  val listTitle: String?,
  val resolvedUrl: String?,
  val requestedCount: Int,
  val failedCount: Int,
  val places: List<GoogleMapsListPreviewPlace>,
  val warnings: List<String>
)

data class GoogleMapsListPreviewPlace(
  val syncKey: String,
  val name: String,
  val category: String,
  val cuisine: String,
  val menu: String,
  val description: String,
  val address: String,
  val googleMapsUrl: String,
  val latitude: Double,
  val longitude: Double,
  val travelMode: String,
  val travelMinutes: Int,
  val distanceLabel: String,
  val noSeafood: Boolean,
  val thumbnailUrl: String?
)

data class GoogleMapsListSyncResponse(
  val listTitle: String?,
  val resolvedUrl: String?,
  val requestedCount: Int,
  val createdCount: Int,
  val skippedExistingCount: Int,
  val skippedDeletedCount: Int,
  val failedCount: Int,
  val created: List<RestaurantResponse>,
  val warnings: List<String>
)

data class GoogleMapsSyncedRestaurantValues(
  val restaurant: RestaurantValues,
  val syncKey: String,
  val sourceUrl: String,
  val listTitle: String?
)

data class GoogleMapsSyncImportResult(
  val created: List<RestaurantResponse>,
  val skippedExistingCount: Int,
  val skippedDeletedCount: Int
)
