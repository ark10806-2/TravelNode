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
        distance_label
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    if (values.isEmpty()) return GoogleMapsSyncImportResult(emptyList(), 0, 0, 0, 0, emptyList())

    val statusSql = """
      SELECT
        id,
        place_status,
        name,
        category,
        cuisine,
        menu,
        description,
        google_maps_note,
        address
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
        place_status,
        google_sync_key,
        google_sync_source_url,
        google_synced_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, now())
      RETURNING *
    """.trimIndent()
    val updateSyncedDetailsSql = """
      UPDATE restaurants
      SET
        cuisine = ?,
        menu = ?,
        description = ?,
        google_maps_note = ?,
        address = ?,
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
        val details = mutableListOf<GoogleMapsSyncDetail>()
        var enrichedCount = 0
        var preservedCustomizedCount = 0
        var skippedExistingCount = 0
        var skippedDeletedCount = 0

        connection.prepareStatement(statusSql).use { statusStatement ->
          connection.prepareStatement(insertSql).use { insertStatement ->
            connection.prepareStatement(updateSyncedDetailsSql).use { updateSyncedDetailsStatement ->
              values.forEach { synced ->
                val existing = statusStatement.findStatus(synced)
                when (existing?.status) {
                  "deleted" -> {
                    skippedDeletedCount += 1
                    details += GoogleMapsSyncDetail(
                      name = synced.restaurant.name,
                      status = "deleted",
                      label = "삭제 차단 유지",
                      updatedFields = emptyList(),
                      preservedFields = emptyList()
                    )
                  }
                  "active" -> {
                    val merge = existing.mergeSyncedDetails(synced.restaurant)
                    updateSyncedDetailsStatement.setString(1, merge.cuisine)
                    updateSyncedDetailsStatement.setString(2, merge.menu)
                    updateSyncedDetailsStatement.setString(3, merge.description)
                    updateSyncedDetailsStatement.setString(4, merge.googleMapsNote)
                    updateSyncedDetailsStatement.setString(5, merge.address)
                    updateSyncedDetailsStatement.setString(6, synced.syncKey)
                    updateSyncedDetailsStatement.setString(7, synced.sourceUrl)
                    updateSyncedDetailsStatement.setObject(8, existing.id)
                    updateSyncedDetailsStatement.addBatch()

                    val detailStatus = when {
                      merge.updatedFields.isNotEmpty() -> {
                        enrichedCount += 1
                        "enriched"
                      }
                      merge.preservedFields.isNotEmpty() -> {
                        preservedCustomizedCount += 1
                        "preserved"
                      }
                      else -> {
                        skippedExistingCount += 1
                        "unchanged"
                      }
                    }
                    details += GoogleMapsSyncDetail(
                      name = existing.name,
                      status = detailStatus,
                      label = when (detailStatus) {
                        "enriched" -> "기본 정보 보강"
                        "preserved" -> "내 입력 보존"
                        else -> "변경 없음"
                      },
                      updatedFields = merge.updatedFields,
                      preservedFields = merge.preservedFields
                    )
                  }
                  else -> {
                    insertStatement.bindValues(synced.restaurant)
                    insertStatement.setString(14, synced.syncKey)
                    insertStatement.setString(15, synced.sourceUrl)
                    insertStatement.executeQuery().use { rows ->
                      rows.next()
                      created += rows.toRestaurant()
                    }
                    details += GoogleMapsSyncDetail(
                      name = synced.restaurant.name,
                      status = "created",
                      label = "새 장소 추가",
                      updatedFields = listOf("전체"),
                      preservedFields = emptyList()
                    )
                  }
                }
              }
              updateSyncedDetailsStatement.executeBatch()
            }
          }
        }

        connection.commit()
        return GoogleMapsSyncImportResult(
          created = created,
          enrichedCount = enrichedCount,
          preservedCustomizedCount = preservedCustomizedCount,
          skippedExistingCount = skippedExistingCount,
          skippedDeletedCount = skippedDeletedCount,
          details = details
        )
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
        updated_at = now()
      WHERE id = ?
        AND place_status = 'active'
      RETURNING *
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.bindValues(values)
        statement.setObject(14, UUID.fromString(id))
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
          status = rows.getString("place_status"),
          name = rows.getString("name"),
          category = rows.getString("category"),
          cuisine = rows.getString("cuisine"),
          menu = rows.getString("menu"),
          description = rows.getString("description"),
          googleMapsNote = rows.getString("google_maps_note"),
          address = rows.getString("address")
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
  }

  private fun ExistingRestaurantStatus.mergeSyncedDetails(values: RestaurantValues): SyncedDetailMerge {
    val updatedFields = mutableListOf<String>()
    val preservedFields = mutableListOf<String>()
    var nextCuisine = cuisine
    var nextMenu = menu
    var nextDescription = description
    var nextGoogleMapsNote = googleMapsNote
    var nextAddress = address

    fun mergeField(
      label: String,
      currentValue: String?,
      incomingValue: String?,
      isDefault: Boolean,
      update: (String?) -> Unit
    ) {
      val normalizedCurrentValue = currentValue.normalizedOrNull()
      val normalizedIncomingValue = incomingValue.normalizedOrNull()
      if (normalizedIncomingValue == null || normalizedIncomingValue == normalizedCurrentValue) return

      if (normalizedCurrentValue == null || isDefault) {
        update(normalizedIncomingValue)
        updatedFields += label
      } else {
        preservedFields += label
      }
    }

    mergeField(
      label = "분류",
      currentValue = cuisine,
      incomingValue = values.cuisine,
      isDefault = isDefaultCuisine(),
      update = { nextCuisine = it.orEmpty() }
    )
    mergeField(
      label = "대표 항목",
      currentValue = menu,
      incomingValue = values.menu,
      isDefault = isDefaultMenu(),
      update = { nextMenu = it.orEmpty() }
    )
    val normalizedIncomingDescription = values.description.normalizedOrNull()
    if (normalizedIncomingDescription != null && normalizedIncomingDescription != description.normalizedOrNull()) {
      nextDescription = normalizedIncomingDescription
      updatedFields += "설명"
    }
    mergeField(
      label = "Google Maps 메모",
      currentValue = googleMapsNote,
      incomingValue = values.googleMapsNote,
      isDefault = googleMapsNote.isNullOrBlank(),
      update = { nextGoogleMapsNote = it }
    )
    mergeField(
      label = "주소",
      currentValue = address,
      incomingValue = values.address,
      isDefault = isDefaultAddress(),
      update = { nextAddress = it.orEmpty() }
    )

    return SyncedDetailMerge(
      cuisine = nextCuisine,
      menu = nextMenu,
      description = nextDescription,
      googleMapsNote = nextGoogleMapsNote,
      address = nextAddress,
      updatedFields = updatedFields.distinct(),
      preservedFields = preservedFields.distinct()
    )
  }

  private fun ExistingRestaurantStatus.isDefaultCuisine(): Boolean {
    return cuisine.trim() == GoogleMapsPlaceInference.cuisine(name, category)
  }

  private fun ExistingRestaurantStatus.isDefaultMenu(): Boolean {
    val defaultMenuValues = setOf(
      GoogleMapsPlaceInference.menu(name, "", category),
      GoogleMapsPlaceInference.menu(name, googleMapsNote.orEmpty(), category)
    )
    return menu.trim() in defaultMenuValues
  }

  private fun ExistingRestaurantStatus.isDefaultDescription(): Boolean {
    val normalizedDescription = description.trim()
    if (normalizedDescription == GoogleMapsPlaceInference.description(name, "", null)) return true

    val escapedName = Regex.escape(name)
    return Regex("""^${escapedName}은 (Google Maps 즐겨찾기|.+ 목록)에서 가져온 장소입니다\. 방문 전 영업시간과 휴무일을 확인해주세요\.$""")
      .matches(normalizedDescription)
  }

  private fun ExistingRestaurantStatus.isDefaultAddress(): Boolean {
    return address.isBlank() || address.trim() == "주소 확인 필요"
  }

  private fun String?.normalizedOrNull() = this?.trim()?.takeIf { it.isNotBlank() }

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
    createdAt = getObject("created_at", OffsetDateTime::class.java),
    updatedAt = getObject("updated_at", OffsetDateTime::class.java)
  )

  private data class ExistingRestaurantStatus(
    val id: UUID,
    val status: String,
    val name: String,
    val category: String,
    val cuisine: String,
    val menu: String,
    val description: String,
    val googleMapsNote: String?,
    val address: String
  )

  private data class SyncedDetailMerge(
    val cuisine: String,
    val menu: String,
    val description: String,
    val googleMapsNote: String?,
    val address: String,
    val updatedFields: List<String>,
    val preservedFields: List<String>
  )
}
