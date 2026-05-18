package com.example.japantrip

import java.sql.ResultSet
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
    """.trimIndent()
    val insertCustomListSql = """
      INSERT INTO custom_todo_lists (id, title, sort_order)
      VALUES (?, ?, ?)
    """.trimIndent()
    val insertCustomItemSql = """
      INSERT INTO custom_todo_items (id, list_id, text, is_done, sort_order)
      VALUES (?, ?, ?, ?, ?)
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.autoCommit = false
      try {
        connection.createStatement().use { statement ->
          statement.executeUpdate("DELETE FROM custom_todo_items")
          statement.executeUpdate("DELETE FROM custom_todo_lists")
          statement.executeUpdate("DELETE FROM todo_items")
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
