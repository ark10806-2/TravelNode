package com.example.japantrip

import java.sql.ResultSet
import java.sql.Types
import javax.sql.DataSource

class TodoRepository(
  private val dataSource: DataSource
) {
  fun findAll(): TodoListResponse {
    val fixedItemsSql = """
      SELECT id, section, day_index, text, is_done
      FROM todo_items
      ORDER BY
        CASE section
          WHEN 'before' THEN 0
          WHEN 'day' THEN 1
          ELSE 2
        END,
        day_index NULLS FIRST,
        sort_order
    """.trimIndent()
    val customListsSql = """
      SELECT id, title
      FROM custom_todo_lists
      ORDER BY sort_order
    """.trimIndent()
    val customItemsSql = """
      SELECT list_id, id, text, is_done
      FROM custom_todo_items
      ORDER BY list_id, sort_order
    """.trimIndent()

    val before = mutableListOf<TodoItemResponse>()
    val days = linkedMapOf<Int, MutableList<TodoItemResponse>>()
    val after = mutableListOf<TodoItemResponse>()
    val custom = linkedMapOf<String, TodoCustomChecklistAccumulator>()

    dataSource.connection.use { connection ->
      connection.prepareStatement(fixedItemsSql).use { statement ->
        statement.executeQuery().use { rows ->
          while (rows.next()) {
            when (rows.getString("section")) {
              "before" -> before += rows.toTodoItem()
              "day" -> days.getOrPut(rows.getInt("day_index")) { mutableListOf() } += rows.toTodoItem()
              "after" -> after += rows.toTodoItem()
            }
          }
        }
      }

      connection.prepareStatement(customListsSql).use { statement ->
        statement.executeQuery().use { rows ->
          while (rows.next()) {
            custom[rows.getString("id")] = TodoCustomChecklistAccumulator(
              title = rows.getString("title"),
              items = mutableListOf()
            )
          }
        }
      }

      connection.prepareStatement(customItemsSql).use { statement ->
        statement.executeQuery().use { rows ->
          while (rows.next()) {
            custom[rows.getString("list_id")]?.items?.add(rows.toTodoItem())
          }
        }
      }
    }

    return TodoListResponse(
      before = before,
      days = days.map { (dayIndex, items) -> TodoDayResponse(dayIndex, items) },
      after = after,
      custom = custom.map { (checklistId, checklist) ->
        TodoCustomChecklistResponse(
          id = checklistId,
          title = checklist.title,
          items = checklist.items
        )
      }
    )
  }

  fun replaceAll(request: TodoSaveRequest): TodoListResponse {
    val insertFixedItemSql = """
      INSERT INTO todo_items (id, section, day_index, text, is_done, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE
      SET
        section = EXCLUDED.section,
        day_index = EXCLUDED.day_index,
        text = EXCLUDED.text,
        is_done = EXCLUDED.is_done,
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
    """.trimIndent()
    val insertCustomListSql = """
      INSERT INTO custom_todo_lists (id, title, sort_order)
      VALUES (?, ?, ?)
      ON CONFLICT (id) DO UPDATE
      SET
        title = EXCLUDED.title,
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
    """.trimIndent()
    val insertCustomItemSql = """
      INSERT INTO custom_todo_items (id, list_id, text, is_done, sort_order)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE
      SET
        list_id = EXCLUDED.list_id,
        text = EXCLUDED.text,
        is_done = EXCLUDED.is_done,
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
    """.trimIndent()
    val hasClientScope = request.knownItemIds != null || request.knownCustomChecklistIds != null
    val submittedItemIds = submittedTodoItemIds(request)
    val submittedChecklistIds = request.custom.orEmpty().map { it.id!!.trim() }

    dataSource.connection.use { connection ->
      connection.autoCommit = false
      try {
        if (!hasClientScope) {
          connection.createStatement().use { statement ->
            statement.executeUpdate("DELETE FROM custom_todo_items")
            statement.executeUpdate("DELETE FROM custom_todo_lists")
            statement.executeUpdate("DELETE FROM todo_items")
          }
        }

        connection.prepareStatement(insertFixedItemSql).use { statement ->
          bindItems(statement, "before", null, request.before.orEmpty())
          request.days.orEmpty().forEach { day ->
            bindItems(statement, "day", day.dayIndex, day.items.orEmpty())
          }
          bindItems(statement, "after", null, request.after.orEmpty())
          statement.executeBatch()
        }

        connection.prepareStatement(insertCustomListSql).use { statement ->
          request.custom.orEmpty().forEachIndexed { checklistIndex, checklist ->
            statement.setString(1, checklist.id!!.trim())
            statement.setString(2, checklist.title!!.trim())
            statement.setInt(3, checklistIndex)
            statement.addBatch()
          }
          statement.executeBatch()
        }

        connection.prepareStatement(insertCustomItemSql).use { statement ->
          request.custom.orEmpty().forEach { checklist ->
            bindCustomItems(statement, checklist.id!!.trim(), checklist.items.orEmpty())
          }
          statement.executeBatch()
        }

        if (hasClientScope) {
          connection.deleteMissingRows(
            "custom_todo_items",
            request.knownItemIds.orEmpty(),
            submittedItemIds
          )
          connection.deleteMissingRows(
            "todo_items",
            request.knownItemIds.orEmpty(),
            submittedItemIds
          )
          connection.deleteMissingRows(
            "custom_todo_lists",
            request.knownCustomChecklistIds.orEmpty(),
            submittedChecklistIds
          )
        }

        connection.commit()
      } catch (cause: Exception) {
        connection.rollback()
        throw cause
      }
    }

    return findAll()
  }

  private fun bindItems(
    statement: java.sql.PreparedStatement,
    section: String,
    dayIndex: Int?,
    items: List<TodoItemRequest>
  ) {
    items.forEachIndexed { itemIndex, item ->
      statement.setString(1, item.id!!.trim())
      statement.setString(2, section)
      if (dayIndex == null) {
        statement.setNull(3, Types.INTEGER)
      } else {
        statement.setInt(3, dayIndex)
      }
      statement.setString(4, item.text!!.trim())
      statement.setBoolean(5, item.done ?: false)
      statement.setInt(6, itemIndex)
      statement.addBatch()
    }
  }

  private fun bindCustomItems(
    statement: java.sql.PreparedStatement,
    checklistId: String,
    items: List<TodoItemRequest>
  ) {
    items.forEachIndexed { itemIndex, item ->
      statement.setString(1, item.id!!.trim())
      statement.setString(2, checklistId)
      statement.setString(3, item.text!!.trim())
      statement.setBoolean(4, item.done ?: false)
      statement.setInt(5, itemIndex)
      statement.addBatch()
    }
  }

  private fun java.sql.Connection.deleteMissingRows(tableName: String, knownIds: List<String>, submittedIds: List<String>) {
    if (knownIds.isEmpty()) return

    val sql = """
      DELETE FROM $tableName
      WHERE id = ANY (?)
        AND NOT (id = ANY (?))
    """.trimIndent()
    prepareStatement(sql).use { statement ->
      statement.setArray(1, createArrayOf("text", knownIds.map(String::trim).toTypedArray()))
      statement.setArray(2, createArrayOf("text", submittedIds.map(String::trim).toTypedArray()))
      statement.executeUpdate()
    }
  }

  private fun submittedTodoItemIds(request: TodoSaveRequest) =
    request.before.orEmpty().map { it.id!!.trim() } +
      request.after.orEmpty().map { it.id!!.trim() } +
      request.days.orEmpty().flatMap { day -> day.items.orEmpty().map { it.id!!.trim() } } +
      request.custom.orEmpty().flatMap { checklist -> checklist.items.orEmpty().map { it.id!!.trim() } }

  private fun ResultSet.toTodoItem() = TodoItemResponse(
    id = getString("id"),
    text = getString("text"),
    done = getBoolean("is_done")
  )

  private data class TodoCustomChecklistAccumulator(
    val title: String,
    val items: MutableList<TodoItemResponse>
  )
}
