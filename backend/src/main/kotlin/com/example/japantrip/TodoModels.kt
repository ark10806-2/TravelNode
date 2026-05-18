package com.example.japantrip

data class TodoListResponse(
  val before: List<TodoItemResponse>,
  val days: List<TodoDayResponse>,
  val after: List<TodoItemResponse>
)

data class TodoDayResponse(
  val dayIndex: Int,
  val items: List<TodoItemResponse>
)

data class TodoItemResponse(
  val id: String,
  val text: String,
  val done: Boolean
)

data class TodoSaveRequest(
  val before: List<TodoItemRequest>? = emptyList(),
  val days: List<TodoDayRequest>? = emptyList(),
  val after: List<TodoItemRequest>? = emptyList()
)

data class TodoDayRequest(
  val dayIndex: Int? = null,
  val items: List<TodoItemRequest>? = emptyList()
)

data class TodoItemRequest(
  val id: String? = null,
  val text: String? = null,
  val done: Boolean? = false
)

fun TodoSaveRequest.validate(): List<String> {
  val errors = mutableListOf<String>()
  val itemIds = mutableSetOf<String>()

  validateItems("before", before.orEmpty(), itemIds, errors)
  validateItems("after", after.orEmpty(), itemIds, errors)

  val dayIndexes = mutableSetOf<Int>()
  days.orEmpty().forEachIndexed { dayPosition, day ->
    val dayIndex = day.dayIndex
    if (dayIndex == null || dayIndex < 0 || dayIndex > MaxTodoDays) {
      errors += "days[$dayPosition].dayIndex must be between 0 and $MaxTodoDays"
    } else if (!dayIndexes.add(dayIndex)) {
      errors += "days[$dayPosition].dayIndex is duplicated"
    }

    validateItems("days[$dayPosition].items", day.items.orEmpty(), itemIds, errors)
  }

  return errors
}

private fun validateItems(
  field: String,
  items: List<TodoItemRequest>,
  itemIds: MutableSet<String>,
  errors: MutableList<String>
) {
  if (items.size > MaxTodoItemsPerSection) {
    errors += "$field must have $MaxTodoItemsPerSection items or fewer"
  }

  items.forEachIndexed { itemIndex, item ->
    val id = item.id?.trim()
    if (!isValidTodoId(id)) {
      errors += "$field[$itemIndex].id is invalid"
    } else if (!itemIds.add(id!!)) {
      errors += "$field[$itemIndex].id is duplicated"
    }

    val text = item.text?.trim()
    if (text.isNullOrBlank()) {
      errors += "$field[$itemIndex].text is required"
    } else if (text.length > MaxTodoTextLength) {
      errors += "$field[$itemIndex].text must be $MaxTodoTextLength characters or fewer"
    }
  }
}

private fun isValidTodoId(value: String?) =
  value != null && value.length <= 120 && value.matches(TodoIdPattern)

private val TodoIdPattern = Regex("^[A-Za-z0-9_-]+$")
const val MaxTodoDays = 60
const val MaxTodoItemsPerSection = 80
const val MaxTodoTextLength = 200
