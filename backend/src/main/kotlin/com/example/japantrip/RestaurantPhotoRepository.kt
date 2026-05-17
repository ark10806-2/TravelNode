package com.example.japantrip

import java.sql.ResultSet
import java.util.UUID
import javax.sql.DataSource

class RestaurantPhotoRepository(
  private val dataSource: DataSource
) {
  fun isCacheFresh(restaurantId: String): Boolean {
    val sql = """
      SELECT photos_cached_at IS NOT NULL AND photos_cached_at > now() - interval '30 days' AS fresh
      FROM restaurants
      WHERE id = ?
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.setObject(1, UUID.fromString(restaurantId))
        statement.executeQuery().use { rows ->
          return rows.next() && rows.getBoolean("fresh")
        }
      }
    }
  }

  fun findByRestaurantId(restaurantId: String): List<StoredRestaurantPhoto> {
    val sql = """
      SELECT id, restaurant_id, source_photo_name, content_type, width_px, height_px, author_name, author_uri, sort_order
      FROM restaurant_photos
      WHERE restaurant_id = ?
      ORDER BY sort_order, created_at
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.setObject(1, UUID.fromString(restaurantId))
        statement.executeQuery().use { rows ->
          return buildList {
            while (rows.next()) add(rows.toStoredPhoto())
          }
        }
      }
    }
  }

  fun findImage(restaurantId: String, photoId: String): StoredRestaurantPhotoImage? {
    val sql = """
      SELECT id, restaurant_id, content_type, image_bytes
      FROM restaurant_photos
      WHERE restaurant_id = ? AND id = ?
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.setObject(1, UUID.fromString(restaurantId))
        statement.setObject(2, UUID.fromString(photoId))
        statement.executeQuery().use { rows ->
          return if (rows.next()) {
            StoredRestaurantPhotoImage(
              id = rows.getObject("id", UUID::class.java).toString(),
              restaurantId = rows.getObject("restaurant_id", UUID::class.java).toString(),
              contentType = rows.getString("content_type"),
              imageBytes = rows.getBytes("image_bytes")
            )
          } else {
            null
          }
        }
      }
    }
  }

  fun replaceForRestaurant(restaurantId: String, photos: List<RestaurantPhotoValues>): List<StoredRestaurantPhoto> {
    if (photos.isEmpty()) {
      markCacheChecked(restaurantId)
      return emptyList()
    }

    val deleteSql = "DELETE FROM restaurant_photos WHERE restaurant_id = ?"
    val insertSql = """
      INSERT INTO restaurant_photos (
        restaurant_id,
        source_photo_name,
        content_type,
        image_bytes,
        width_px,
        height_px,
        author_name,
        author_uri,
        sort_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id, restaurant_id, source_photo_name, content_type, width_px, height_px, author_name, author_uri, sort_order
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.autoCommit = false
      try {
        connection.prepareStatement(deleteSql).use { statement ->
          statement.setObject(1, UUID.fromString(restaurantId))
          statement.executeUpdate()
        }

        val saved = buildList {
          connection.prepareStatement(insertSql).use { statement ->
            photos.forEachIndexed { index, photo ->
              statement.setObject(1, UUID.fromString(restaurantId))
              statement.setString(2, photo.sourcePhotoName)
              statement.setString(3, photo.contentType)
              statement.setBytes(4, photo.imageBytes)
              statement.setObject(5, photo.widthPx)
              statement.setObject(6, photo.heightPx)
              statement.setString(7, photo.authorName)
              statement.setString(8, photo.authorUri)
              statement.setInt(9, index)
              statement.executeQuery().use { rows ->
                rows.next()
                add(rows.toStoredPhoto())
              }
            }
          }
        }

        connection.commit()
        return saved
      } catch (cause: Exception) {
        connection.rollback()
        throw cause
      } finally {
        connection.autoCommit = true
      }
    }
  }

  private fun ResultSet.toStoredPhoto() = StoredRestaurantPhoto(
    id = getObject("id", UUID::class.java).toString(),
    restaurantId = getObject("restaurant_id", UUID::class.java).toString(),
    sourcePhotoName = getString("source_photo_name"),
    contentType = getString("content_type"),
    widthPx = getObject("width_px") as Int?,
    heightPx = getObject("height_px") as Int?,
    authorName = getString("author_name"),
    authorUri = getString("author_uri"),
    sortOrder = getInt("sort_order")
  )

  private fun markCacheChecked(restaurantId: String) {
    dataSource.connection.use { connection ->
      connection.prepareStatement("UPDATE restaurants SET photos_cached_at = now() WHERE id = ?").use { statement ->
        statement.setObject(1, UUID.fromString(restaurantId))
        statement.executeUpdate()
      }
    }
  }
}

data class StoredRestaurantPhoto(
  val id: String,
  val restaurantId: String,
  val sourcePhotoName: String,
  val contentType: String,
  val widthPx: Int?,
  val heightPx: Int?,
  val authorName: String?,
  val authorUri: String?,
  val sortOrder: Int
)

data class StoredRestaurantPhotoImage(
  val id: String,
  val restaurantId: String,
  val contentType: String,
  val imageBytes: ByteArray
)

fun StoredRestaurantPhoto.toResponse(publicBaseUrl: String) = RestaurantPhotoResponse(
  url = "${publicBaseUrl.trimEnd('/')}/api/restaurants/$restaurantId/photos/$id/image",
  widthPx = widthPx,
  heightPx = heightPx,
  authorName = authorName,
  authorUri = authorUri
)
