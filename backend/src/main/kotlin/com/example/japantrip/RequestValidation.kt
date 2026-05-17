package com.example.japantrip

val allowedTravelModes = setOf("walk", "transit")
val allowedRouteLegStatuses = setOf("ready", "estimated", "error")
val allowedRouteModes = setOf("driving", "transit", "walking")

fun validateFilters(category: String?, travelMode: String?): List<String> {
  val errors = mutableListOf<String>()
  if (category != null && category.isBlank()) errors += "category must not be blank"
  if (travelMode != null && travelMode !in allowedTravelModes) errors += "travelMode must be walk or transit"
  return errors
}

fun normalizeCategory(category: String?) = category?.trim()?.takeIf { it.isNotBlank() } ?: "meal"
