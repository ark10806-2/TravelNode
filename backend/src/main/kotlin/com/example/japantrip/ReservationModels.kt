package com.example.japantrip

data class ReservationResponse(
  val id: String,
  val reservationType: String,
  val title: String,
  val dayIndex: Int? = null,
  val placeId: String? = null,
  val timeLabel: String = "",
  val referenceNumber: String = "",
  val linkUrl: String = "",
  val notes: String = ""
)

data class ReservationSaveRequest(
  val reservations: List<ReservationRequest>? = emptyList()
)

data class ReservationRequest(
  val id: String? = null,
  val reservationType: String? = null,
  val title: String? = null,
  val dayIndex: Int? = null,
  val placeId: String? = null,
  val timeLabel: String? = "",
  val referenceNumber: String? = "",
  val linkUrl: String? = "",
  val notes: String? = ""
)

fun ReservationSaveRequest.validate(): List<String> {
  val errors = mutableListOf<String>()
  val reservationIds = mutableSetOf<String>()
  val requestedReservations = reservations.orEmpty()

  if (requestedReservations.size > MaxReservations) {
    errors += "reservations must have $MaxReservations items or fewer"
  }

  requestedReservations.forEachIndexed { index, reservation ->
    val id = reservation.id?.trim()
    if (!isValidReservationId(id)) {
      errors += "reservations[$index].id is invalid"
    } else if (!reservationIds.add(id!!)) {
      errors += "reservations[$index].id is duplicated"
    }

    val reservationType = reservation.reservationType?.trim()
    if (reservationType == null || reservationType !in allowedReservationTypes) {
      errors += "reservations[$index].reservationType must be restaurant, ticket, transport, hotel, or other"
    }

    val title = reservation.title?.trim()
    if (title.isNullOrBlank()) {
      errors += "reservations[$index].title is required"
    } else if (title.length > MaxReservationTitleLength) {
      errors += "reservations[$index].title must be $MaxReservationTitleLength characters or fewer"
    }

    val dayIndex = reservation.dayIndex
    if (dayIndex != null && (dayIndex < 0 || dayIndex > MaxReservationDayIndex)) {
      errors += "reservations[$index].dayIndex must be between 0 and $MaxReservationDayIndex"
    }

    val placeId = reservation.placeId?.trim()?.takeIf { it.isNotBlank() }
    if (placeId != null) {
      validateUuid("reservations[$index].placeId", placeId)?.let { errors += it }
    }

    validateLength(errors, "reservations[$index].timeLabel", reservation.timeLabel, MaxReservationTimeLength)
    validateLength(errors, "reservations[$index].referenceNumber", reservation.referenceNumber, MaxReservationReferenceLength)
    validateLength(errors, "reservations[$index].linkUrl", reservation.linkUrl, MaxReservationUrlLength)
    validateLength(errors, "reservations[$index].notes", reservation.notes, MaxReservationNotesLength)
  }

  return errors
}

private fun validateLength(errors: MutableList<String>, field: String, value: String?, maxLength: Int) {
  if ((value?.trim()?.length ?: 0) > maxLength) {
    errors += "$field must be $maxLength characters or fewer"
  }
}

private fun isValidReservationId(value: String?) =
  value != null && value.length <= 120 && value.matches(ReservationIdPattern)

private val ReservationIdPattern = Regex("^[A-Za-z0-9_-]+$")
private val allowedReservationTypes = setOf("restaurant", "ticket", "transport", "hotel", "other")
const val MaxReservations = 200
const val MaxReservationDayIndex = 60
const val MaxReservationTitleLength = 120
const val MaxReservationTimeLength = 80
const val MaxReservationReferenceLength = 120
const val MaxReservationUrlLength = 500
const val MaxReservationNotesLength = 1000
