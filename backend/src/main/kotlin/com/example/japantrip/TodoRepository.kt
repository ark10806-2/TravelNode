package com.example.japantrip

import java.sql.ResultSet
import javax.sql.DataSource

class TodoRepository(
  private val dataSource: DataSource
) {
  fun findAll(): TodoListResponse {
    val sql = """
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

    val before = mutableListOf<TodoItemResponse>()
    val days = linkedMapOf<Int, MutableList<TodoItemResponse>>()
    val after = mutableListOf<TodoItemResponse>()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
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
    }

    return TodoListResponse(
      before = before,
      days = days.map { (dayIndex, items) -> TodoDayResponse(dayIndex, items) },
      after = after
    )
  }

  fun replaceAll(request: TodoSaveRequest): TodoListResponse {
    val insertSql = """
      INSERT INTO todo_items (id, section, day_index, text, is_done, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.autoCommit = false
      try {
        connection.createStatement().use { statement ->
          statement.executeUpdate("DELETE FROM todo_items")
        }

        connection.prepareStatement(insertSql).use { statement ->
          bindItems(statement, "before", null, request.before.orEmpty())
          request.days.orEmpty().forEach { day ->
            bindItems(statement, "day", day.dayIndex, day.items.orEmpty())
          }
          bindItems(statement, "after", null, request.after.orEmpty())
          statement.executeBatch()
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
        statement.setNull(3, java.sql.Types.INTEGER)
      } else {
        statement.setInt(3, dayIndex)
      }
      statement.setString(4, item.text!!.trim())
      statement.setBoolean(5, item.done ?: false)
      statement.setInt(6, itemIndex)
      statement.addBatch()
    }
  }

  private fun ResultSet.toTodoItem() = TodoItemResponse(
    id = getString("id"),
    text = getString("text"),
    done = getBoolean("is_done")
  )
}
