package com.example.japantrip

data class CategoryResponse(
  val id: String,
  val label: String,
  val emoji: String,
  val sortOrder: Int
)

data class CategoryRequest(
  val label: String? = null,
  val emoji: String? = null
)

fun CategoryRequest.validate(): List<String> {
  val errors = mutableListOf<String>()
  if (label.isNullOrBlank()) errors += "label is required"
  if (!emoji.isNullOrBlank() && emoji.length > 8) errors += "emoji is too long"
  return errors
}
