package com.example.japantrip

import java.sql.ResultSet
import java.sql.Types
import java.util.UUID
import javax.sql.DataSource

class ReservationRepository(
  private val dataSource: DataSource
) {
  fun findAll(): List<ReservationResponse> {
    val sql = """
      SELECT
        id,
        reservation_type,
        title,
        day_index,
        place_id,
        time_label,
        reference_number,
        link_url,
        notes
      FROM reservations
      ORDER BY COALESCE(day_index, 9999), sort_order
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.executeQuery().use { rows ->
          val reservations = mutableListOf<ReservationResponse>()
          while (rows.next()) {
            reservations += rows.toReservation()
          }
          return reservations
        }
      }
    }
  }

  fun replaceAll(request: ReservationSaveRequest): List<ReservationResponse> {
    val insertSql = """
      INSERT INTO reservations (
        id,
        reservation_type,
        title,
        day_index,
        place_id,
        time_label,
        reference_number,
        link_url,
        notes,
        sort_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.autoCommit = false
      try {
        connection.createStatement().use { statement ->
          statement.executeUpdate("DELETE FROM reservations")
        }

        connection.prepareStatement(insertSql).use { statement ->
          request.reservations.orEmpty().forEachIndexed { index, reservation ->
            statement.setString(1, reservation.id!!.trim())
            statement.setString(2, reservation.reservationType!!.trim())
            statement.setString(3, reservation.title!!.trim())
            val dayIndex = reservation.dayIndex
            if (dayIndex == null) {
              statement.setNull(4, Types.INTEGER)
            } else {
              statement.setInt(4, dayIndex)
            }

            val placeId = reservation.placeId?.trim()?.takeIf { it.isNotBlank() }
            if (placeId == null) {
              statement.setNull(5, Types.OTHER)
            } else {
              statement.setObject(5, UUID.fromString(placeId))
            }

            statement.setString(6, reservation.timeLabel.orEmpty().trim())
            statement.setString(7, reservation.referenceNumber.orEmpty().trim())
            statement.setString(8, reservation.linkUrl.orEmpty().trim())
            statement.setString(9, reservation.notes.orEmpty().trim())
            statement.setInt(10, index)
            statement.addBatch()
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

  private fun ResultSet.toReservation() = ReservationResponse(
    id = getString("id"),
    reservationType = getString("reservation_type"),
    title = getString("title"),
    dayIndex = getObject("day_index") as Int?,
    placeId = getObject("place_id", UUID::class.java)?.toString(),
    timeLabel = getString("time_label"),
    referenceNumber = getString("reference_number"),
    linkUrl = getString("link_url"),
    notes = getString("notes")
  )
}
