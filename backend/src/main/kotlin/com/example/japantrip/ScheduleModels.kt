package com.example.japantrip

data class ScheduleStopResponse(
  val id: String,
  val placeId: String,
  val selectedRouteMode: String? = null,
  val departureTimeMinutes: Int? = null
)

data class ScheduleDayResponse(
  val id: String,
  val stops: List<ScheduleStopResponse>,
  val selectedReturnRouteMode: String? = null,
  val hotelPlaceId: String? = null,
  val departureTimeMinutes: Int? = null
)

data class ScheduleSaveRequest(
  val days: List<ScheduleDayRequest>? = null
)

data class ScheduleDayRequest(
  val id: String? = null,
  val stops: List<ScheduleStopRequest>? = emptyList(),
  val selectedReturnRouteMode: String? = null,
  val hotelPlaceId: String? = null,
  val departureTimeMinutes: Int? = null
)

data class ScheduleStopRequest(
  val id: String? = null,
  val placeId: String? = null,
  val selectedRouteMode: String? = null,
  val departureTimeMinutes: Int? = null
)

fun ScheduleSaveRequest.validate(): List<String> {
  val errors = mutableListOf<String>()
  val requestedDays = days

  if (requestedDays == null) {
    errors += "days is required"
    return errors
  }

  if (requestedDays.size > MaxScheduleDays) {
    errors += "days must have $MaxScheduleDays items or fewer"
  }

  val dayIds = mutableSetOf<String>()
  val stopIds = mutableSetOf<String>()

  requestedDays.forEachIndexed { dayIndex, day ->
    val dayId = day.id?.trim()
    if (!isValidScheduleId(dayId)) {
      errors += "days[$dayIndex].id is invalid"
    } else if (!dayIds.add(dayId!!)) {
      errors += "days[$dayIndex].id is duplicated"
    }

    val selectedReturnRouteMode = day.selectedReturnRouteMode?.trim()
    if (selectedReturnRouteMode != null && selectedReturnRouteMode !in allowedRouteModes) {
      errors += "days[$dayIndex].selectedReturnRouteMode must be driving, transit, or walking"
    }

    val hotelPlaceId = day.hotelPlaceId?.trim()?.takeIf { it.isNotBlank() }
    if (hotelPlaceId != null) {
      validateUuid("days[$dayIndex].hotelPlaceId", hotelPlaceId)?.let { errors += it }
    }

    validateDepartureTimeMinutes("days[$dayIndex].departureTimeMinutes", day.departureTimeMinutes)?.let { errors += it }

    val stops = day.stops.orEmpty()
    if (stops.size > MaxScheduleStopsPerDay) {
      errors += "days[$dayIndex].stops must have $MaxScheduleStopsPerDay items or fewer"
    }

    val placeIdsInDay = mutableSetOf<String>()
    stops.forEachIndexed { stopIndex, stop ->
      val stopId = stop.id?.trim()
      val placeId = stop.placeId?.trim()

      if (!isValidScheduleId(stopId)) {
        errors += "days[$dayIndex].stops[$stopIndex].id is invalid"
      } else if (!stopIds.add(stopId!!)) {
        errors += "days[$dayIndex].stops[$stopIndex].id is duplicated"
      }

      val placeIdError = validateUuid("days[$dayIndex].stops[$stopIndex].placeId", placeId)
      if (placeIdError != null) {
        errors += placeIdError
      } else if (!placeIdsInDay.add(placeId!!)) {
        errors += "days[$dayIndex].stops[$stopIndex].placeId is duplicated in the day"
      }

      val selectedRouteMode = stop.selectedRouteMode?.trim()
      if (selectedRouteMode != null && selectedRouteMode !in allowedRouteModes) {
        errors += "days[$dayIndex].stops[$stopIndex].selectedRouteMode must be driving, transit, or walking"
      }

      validateDepartureTimeMinutes("days[$dayIndex].stops[$stopIndex].departureTimeMinutes", stop.departureTimeMinutes)?.let { errors += it }
    }
  }

  return errors
}

private fun isValidScheduleId(value: String?) =
  value != null && value.length <= 120 && value.matches(ScheduleIdPattern)

private fun validateDepartureTimeMinutes(field: String, value: Int?) =
  when {
    value == null -> null
    value < 0 || value >= 1440 || value % 30 != 0 -> "$field must be a 30-minute value between 0 and 1410"
    else -> null
  }

private val ScheduleIdPattern = Regex("^[A-Za-z0-9_-]+$")
const val MaxScheduleDays = 30
const val MaxScheduleStopsPerDay = 20
