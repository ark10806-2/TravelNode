package com.example.japantrip

import java.util.UUID

fun validateUuid(id: String?): String? {
  if (id == null) return "id is required"

  return try {
    UUID.fromString(id)
    null
  } catch (_: IllegalArgumentException) {
    "id must be a valid UUID"
  }
}

fun validateUuid(fieldName: String, id: String?): String? {
  if (id == null) return "$fieldName is required"

  return try {
    UUID.fromString(id)
    null
  } catch (_: IllegalArgumentException) {
    "$fieldName must be a valid UUID"
  }
}
