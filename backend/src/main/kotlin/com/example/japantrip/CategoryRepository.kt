package com.example.japantrip

import java.sql.ResultSet
import java.util.UUID
import javax.sql.DataSource

class CategoryRepository(
  private val dataSource: DataSource
) {
  fun findAll(): List<CategoryResponse> {
    val sql = """
      SELECT id, label, emoji, sort_order
      FROM categories
      ORDER BY sort_order, label
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.executeQuery().use { rows ->
          return buildList {
            while (rows.next()) add(rows.toCategory())
          }
        }
      }
    }
  }

  fun create(request: CategoryRequest): CategoryResponse {
    val sql = """
      INSERT INTO categories (id, label, emoji, sort_order)
      VALUES (
        ?,
        ?,
        ?,
        COALESCE((SELECT MAX(sort_order) + 10 FROM categories), 100)
      )
      ON CONFLICT (label) DO UPDATE
      SET emoji = EXCLUDED.emoji
      RETURNING id, label, emoji, sort_order
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.setString(1, UUID.randomUUID().toString())
        statement.setString(2, request.label!!.trim())
        statement.setString(3, request.emoji?.trim()?.takeIf { it.isNotBlank() } ?: "📍")
        statement.executeQuery().use { rows ->
          rows.next()
          return rows.toCategory()
        }
      }
    }
  }

  fun delete(id: String): CategoryDeleteResult {
    if (id in DefaultCategoryIds) return CategoryDeleteResult.DefaultCategory

    dataSource.connection.use { connection ->
      connection.prepareStatement("SELECT COUNT(*) FROM restaurants WHERE category = ? AND place_status = 'active'").use { statement ->
        statement.setString(1, id)
        statement.executeQuery().use { rows ->
          rows.next()
          if (rows.getInt(1) > 0) return CategoryDeleteResult.InUse
        }
      }

      connection.prepareStatement(
        """
          UPDATE restaurants
          SET
            category = 'meal',
            updated_at = now()
          WHERE category = ?
            AND place_status = 'deleted'
        """.trimIndent()
      ).use { statement ->
        statement.setString(1, id)
        statement.executeUpdate()
      }

      connection.prepareStatement("DELETE FROM categories WHERE id = ?").use { statement ->
        statement.setString(1, id)
        return if (statement.executeUpdate() > 0) CategoryDeleteResult.Deleted else CategoryDeleteResult.NotFound
      }
    }
  }

  private fun ResultSet.toCategory() = CategoryResponse(
    id = getString("id"),
    label = getString("label"),
    emoji = getString("emoji"),
    sortOrder = getInt("sort_order")
  )

  private companion object {
    val DefaultCategoryIds = setOf("meal", "dessert", "sightseeing")
  }
}

enum class CategoryDeleteResult {
  Deleted,
  NotFound,
  InUse,
  DefaultCategory
}
