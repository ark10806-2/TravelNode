package com.example.japantrip

import java.sql.PreparedStatement
import java.sql.ResultSet
import java.time.OffsetDateTime
import java.util.UUID
import javax.sql.DataSource

class RestaurantRepository(
  private val dataSource: DataSource
) {
  fun findAll(category: String?, travelMode: String?): List<RestaurantResponse> {
    val filters = mutableListOf("place_status = 'active'")
    val values = mutableListOf<String>()

    if (category != null) {
      filters += "category = ?"
      values += category
    }

    if (travelMode != null) {
      filters += "travel_mode = ?"
      values += travelMode
    }

    val where = if (filters.isEmpty()) "" else "WHERE ${filters.joinToString(" AND ")}"
    val sql = """
      SELECT *
      FROM restaurants
      $where
      ORDER BY travel_mode, category, travel_minutes, name
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        values.forEachIndexed { index, value -> statement.setString(index + 1, value) }
        statement.executeQuery().use { rows ->
          return buildList {
            while (rows.next()) add(rows.toRestaurant())
          }
        }
      }
    }
  }

  fun findById(id: String): RestaurantResponse? {
    dataSource.connection.use { connection ->
      connection.prepareStatement("SELECT * FROM restaurants WHERE id = ? AND place_status = 'active'").use { statement ->
        statement.setObject(1, UUID.fromString(id))
        statement.executeQuery().use { rows ->
          return if (rows.next()) rows.toRestaurant() else null
        }
      }
    }
  }

  fun create(values: RestaurantValues): RestaurantResponse {
    val sql = """
      INSERT INTO restaurants (
        name,
        category,
        cuisine,
        menu,
        description,
        google_maps_note,
        address,
        google_maps_url,
        latitude,
        longitude,
        travel_mode,
        travel_minutes,
        distance_label,
        no_seafood
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.bindValues(values)
        statement.executeQuery().use { rows ->
          rows.next()
          return rows.toRestaurant()
        }
      }
    }
  }

  fun importSynced(values: List<GoogleMapsSyncedRestaurantValues>): GoogleMapsSyncImportResult {
    if (values.isEmpty()) return GoogleMapsSyncImportResult(emptyList(), 0, 0)

    val statusSql = """
      SELECT id, place_status
      FROM restaurants
      WHERE google_sync_key = ?
        OR (
          lower(name) = lower(?)
          AND abs(latitude - ?) < 0.00001
          AND abs(longitude - ?) < 0.00001
        )
      ORDER BY CASE WHEN google_sync_key = ? THEN 0 ELSE 1 END
      LIMIT 1
    """.trimIndent()
    val insertSql = """
      INSERT INTO restaurants (
        name,
        category,
        cuisine,
        menu,
        description,
        google_maps_note,
        address,
        google_maps_url,
        latitude,
        longitude,
        travel_mode,
        travel_minutes,
        distance_label,
        no_seafood,
        place_status,
        google_sync_key,
        google_sync_source_url,
        google_synced_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, now())
      RETURNING *
    """.trimIndent()
    val updateNoteSql = """
      UPDATE restaurants
      SET
        google_maps_note = ?,
        google_sync_key = COALESCE(google_sync_key, ?),
        google_sync_source_url = ?,
        google_synced_at = now(),
        updated_at = now()
      WHERE id = ?
        AND place_status = 'active'
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.autoCommit = false
      try {
        val created = mutableListOf<RestaurantResponse>()
        var skippedExistingCount = 0
        var skippedDeletedCount = 0

        connection.prepareStatement(statusSql).use { statusStatement ->
          connection.prepareStatement(insertSql).use { insertStatement ->
            connection.prepareStatement(updateNoteSql).use { updateNoteStatement ->
              values.forEach { synced ->
                val existing = statusStatement.findStatus(synced)
                when (existing?.status) {
                  "deleted" -> skippedDeletedCount += 1
                  "active" -> {
                    updateNoteStatement.setString(1, synced.restaurant.googleMapsNote)
                    updateNoteStatement.setString(2, synced.syncKey)
                    updateNoteStatement.setString(3, synced.sourceUrl)
                    updateNoteStatement.setObject(4, existing.id)
                    updateNoteStatement.addBatch()
                    skippedExistingCount += 1
                  }
                  else -> {
                    insertStatement.bindValues(synced.restaurant)
                    insertStatement.setString(15, synced.syncKey)
                    insertStatement.setString(16, synced.sourceUrl)
                    insertStatement.executeQuery().use { rows ->
                      rows.next()
                      created += rows.toRestaurant()
                    }
                  }
                }
              }
              updateNoteStatement.executeBatch()
            }
          }
        }

        connection.commit()
        return GoogleMapsSyncImportResult(created, skippedExistingCount, skippedDeletedCount)
      } catch (cause: Exception) {
        connection.rollback()
        throw cause
      }
    }
  }

  fun update(id: String, values: RestaurantValues): RestaurantResponse? {
    val sql = """
      UPDATE restaurants
      SET
        name = ?,
        category = ?,
        cuisine = ?,
        menu = ?,
        description = ?,
        google_maps_note = ?,
        address = ?,
        google_maps_url = ?,
        latitude = ?,
        longitude = ?,
        travel_mode = ?,
        travel_minutes = ?,
        distance_label = ?,
        no_seafood = ?,
        updated_at = now()
      WHERE id = ?
        AND place_status = 'active'
      RETURNING *
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.bindValues(values)
        statement.setObject(15, UUID.fromString(id))
        statement.executeQuery().use { rows ->
          return if (rows.next()) rows.toRestaurant() else null
        }
      }
    }
  }

  fun updateDescription(id: String, description: String): RestaurantResponse? {
    val sql = """
      UPDATE restaurants
      SET
        description = ?,
        updated_at = now()
      WHERE id = ?
        AND place_status = 'active'
      RETURNING *
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.setString(1, description.trim())
        statement.setObject(2, UUID.fromString(id))
        statement.executeQuery().use { rows ->
          return if (rows.next()) rows.toRestaurant() else null
        }
      }
    }
  }

  fun delete(id: String): Boolean {
    dataSource.connection.use { connection ->
      val sql = """
        UPDATE restaurants
        SET
          place_status = 'deleted',
          updated_at = now()
        WHERE id = ?
          AND place_status = 'active'
      """.trimIndent()

      connection.prepareStatement(sql).use { statement ->
        statement.setObject(1, UUID.fromString(id))
        return statement.executeUpdate() > 0
      }
    }
  }

  private fun PreparedStatement.findStatus(values: GoogleMapsSyncedRestaurantValues): ExistingRestaurantStatus? {
    setString(1, values.syncKey)
    setString(2, values.restaurant.name)
    setDouble(3, values.restaurant.latitude)
    setDouble(4, values.restaurant.longitude)
    setString(5, values.syncKey)
    executeQuery().use { rows ->
      return if (rows.next()) {
        ExistingRestaurantStatus(
          id = rows.getObject("id", UUID::class.java),
          status = rows.getString("place_status")
        )
      } else {
        null
      }
    }
  }

  private fun PreparedStatement.bindValues(values: RestaurantValues) {
    setString(1, values.name)
    setString(2, values.category)
    setString(3, values.cuisine)
    setString(4, values.menu)
    setString(5, values.description)
    setString(6, values.googleMapsNote)
    setString(7, values.address)
    setString(8, values.googleMapsUrl)
    setDouble(9, values.latitude)
    setDouble(10, values.longitude)
    setString(11, values.travelMode)
    setInt(12, values.travelMinutes)
    setString(13, values.distanceLabel)
    setBoolean(14, values.noSeafood)
  }

  private fun ResultSet.toRestaurant() = RestaurantResponse(
    id = getObject("id", UUID::class.java).toString(),
    name = getString("name"),
    category = getString("category"),
    cuisine = getString("cuisine"),
    menu = getString("menu"),
    description = getString("description"),
    googleMapsNote = getString("google_maps_note"),
    address = getString("address"),
    googleMapsUrl = getString("google_maps_url"),
    latitude = getDouble("latitude"),
    longitude = getDouble("longitude"),
    travelMode = getString("travel_mode"),
    travelMinutes = getInt("travel_minutes"),
    distanceLabel = getString("distance_label"),
    noSeafood = getBoolean("no_seafood"),
    createdAt = getObject("created_at", OffsetDateTime::class.java),
    updatedAt = getObject("updated_at", OffsetDateTime::class.java)
  )

  private data class ExistingRestaurantStatus(
    val id: UUID,
    val status: String
  )
}
