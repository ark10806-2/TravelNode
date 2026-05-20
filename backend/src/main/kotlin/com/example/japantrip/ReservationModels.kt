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
  val notes: String = "",
  val attachments: List<ReservationAttachmentResponse> = emptyList(),
  val completed: Boolean = false
)

data class ReservationSaveRequest(
  val reservations: List<ReservationRequest>? = emptyList(),
  val knownReservationIds: List<String>? = null
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
  val notes: String? = "",
  val attachments: List<ReservationAttachmentRequest>? = emptyList(),
  val completed: Boolean? = false
)

data class ReservationAttachmentResponse(
  val id: String,
  val fileName: String,
  val contentType: String,
  val sizeBytes: Int,
  val dataUrl: String
)

data class ReservationAttachmentRequest(
  val id: String? = null,
  val fileName: String? = null,
  val contentType: String? = null,
  val sizeBytes: Int? = null,
  val dataUrl: String? = null
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
    validateAttachments(errors, "reservations[$index].attachments", reservation.attachments.orEmpty())
  }

  validateKnownReservationIds(errors, knownReservationIds)

  return errors
}

private fun validateKnownReservationIds(errors: MutableList<String>, ids: List<String>?) {
  val knownIds = ids ?: return
  if (knownIds.size > MaxKnownReservationIds) {
    errors += "knownReservationIds must have $MaxKnownReservationIds ids or fewer"
  }

  val uniqueIds = mutableSetOf<String>()
  knownIds.forEachIndexed { index, rawId ->
    val id = rawId.trim()
    if (!isValidReservationId(id)) {
      errors += "knownReservationIds[$index] is invalid"
    } else if (!uniqueIds.add(id)) {
      errors += "knownReservationIds[$index] is duplicated"
    }
  }
}

private fun validateAttachments(
  errors: MutableList<String>,
  field: String,
  attachments: List<ReservationAttachmentRequest>
) {
  if (attachments.size > MaxReservationAttachments) {
    errors += "$field must have $MaxReservationAttachments files or fewer"
  }

  val attachmentIds = mutableSetOf<String>()
  var totalSizeBytes = 0
  attachments.forEachIndexed { index, attachment ->
    val id = attachment.id?.trim()
    if (!isValidReservationId(id)) {
      errors += "$field[$index].id is invalid"
    } else if (!attachmentIds.add(id!!)) {
      errors += "$field[$index].id is duplicated"
    }

    val fileName = attachment.fileName?.trim()
    if (fileName.isNullOrBlank()) {
      errors += "$field[$index].fileName is required"
    } else if (fileName.length > MaxReservationAttachmentFileNameLength) {
      errors += "$field[$index].fileName must be $MaxReservationAttachmentFileNameLength characters or fewer"
    }

    val contentType = attachment.contentType?.trim().orEmpty()
    if (!isAllowedAttachmentContentType(contentType)) {
      errors += "$field[$index].contentType must be an image or application/pdf"
    }

    val sizeBytes = attachment.sizeBytes
    if (sizeBytes == null || sizeBytes < 0 || sizeBytes > MaxReservationAttachmentBytes) {
      errors += "$field[$index].sizeBytes must be between 0 and $MaxReservationAttachmentBytes"
    } else {
      totalSizeBytes += sizeBytes
    }

    val dataUrl = attachment.dataUrl?.trim().orEmpty()
    if (!dataUrl.startsWith("data:$contentType;base64,")) {
      errors += "$field[$index].dataUrl is invalid"
    } else if (dataUrl.length > MaxReservationAttachmentDataUrlLength) {
      errors += "$field[$index].dataUrl is too large"
    }
  }

  if (totalSizeBytes > MaxReservationAttachmentTotalBytes) {
    errors += "$field total size must be $MaxReservationAttachmentTotalBytes bytes or fewer"
  }
}

private fun validateLength(errors: MutableList<String>, field: String, value: String?, maxLength: Int) {
  if ((value?.trim()?.length ?: 0) > maxLength) {
    errors += "$field must be $maxLength characters or fewer"
  }
}

private fun isValidReservationId(value: String?) =
  value != null && value.length <= 120 && value.matches(ReservationIdPattern)

private fun isAllowedAttachmentContentType(value: String) =
  value.startsWith("image/") || value == "application/pdf"

private val ReservationIdPattern = Regex("^[A-Za-z0-9_-]+$")
private val allowedReservationTypes = setOf("restaurant", "ticket", "transport", "hotel", "other")
const val MaxReservations = 200
const val MaxReservationDayIndex = 60
const val MaxReservationTitleLength = 120
const val MaxReservationTimeLength = 80
const val MaxReservationReferenceLength = 120
const val MaxReservationUrlLength = 500
const val MaxReservationNotesLength = 1000
const val MaxReservationAttachments = 8
const val MaxReservationAttachmentBytes = 5 * 1024 * 1024
const val MaxReservationAttachmentTotalBytes = 20 * 1024 * 1024
const val MaxReservationAttachmentFileNameLength = 180
const val MaxReservationAttachmentDataUrlLength = 7 * 1024 * 1024
const val MaxKnownReservationIds = 1_000
