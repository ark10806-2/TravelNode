package com.example.japantrip

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import java.sql.ResultSet
import java.sql.Types
import java.util.UUID
import javax.sql.DataSource

class ReservationRepository(
  private val dataSource: DataSource
) {
  private val mapper = jacksonObjectMapper()

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
        notes,
        attachments,
        completed
      FROM reservations
      ORDER BY completed, COALESCE(day_index, 9999), sort_order
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
        attachments,
        completed,
        sort_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)
      ON CONFLICT (id) DO UPDATE
      SET
        reservation_type = EXCLUDED.reservation_type,
        title = EXCLUDED.title,
        day_index = EXCLUDED.day_index,
        place_id = EXCLUDED.place_id,
        time_label = EXCLUDED.time_label,
        reference_number = EXCLUDED.reference_number,
        link_url = EXCLUDED.link_url,
        notes = EXCLUDED.notes,
        attachments = EXCLUDED.attachments,
        completed = EXCLUDED.completed,
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
    """.trimIndent()
    val hasClientScope = request.knownReservationIds != null
    val submittedIds = request.reservations.orEmpty().map { it.id!!.trim() }

    dataSource.connection.use { connection ->
      connection.autoCommit = false
      try {
        if (!hasClientScope) {
          connection.createStatement().use { statement ->
            statement.executeUpdate("DELETE FROM reservations")
          }
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
            statement.setString(10, mapper.writeValueAsString(reservation.attachments.orEmpty().map { it.toResponse() }))
            statement.setBoolean(11, reservation.completed == true)
            statement.setInt(12, index)
            statement.addBatch()
          }
          statement.executeBatch()
        }

        if (hasClientScope) {
          connection.deleteMissingReservations(request.knownReservationIds.orEmpty(), submittedIds)
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
    notes = getString("notes"),
    attachments = parseAttachments(getString("attachments")),
    completed = getBoolean("completed")
  )

  private fun parseAttachments(value: String?): List<ReservationAttachmentResponse> {
    if (value.isNullOrBlank()) return emptyList()
    return mapper.readValue(value, object : TypeReference<List<ReservationAttachmentResponse>>() {})
  }

  private fun java.sql.Connection.deleteMissingReservations(knownIds: List<String>, submittedIds: List<String>) {
    if (knownIds.isEmpty()) return

    val sql = """
      DELETE FROM reservations
      WHERE id = ANY (?)
        AND NOT (id = ANY (?))
    """.trimIndent()
    prepareStatement(sql).use { statement ->
      statement.setArray(1, createArrayOf("text", knownIds.map(String::trim).toTypedArray()))
      statement.setArray(2, createArrayOf("text", submittedIds.map(String::trim).toTypedArray()))
      statement.executeUpdate()
    }
  }

  private fun ReservationAttachmentRequest.toResponse() = ReservationAttachmentResponse(
    id = id!!.trim(),
    fileName = fileName!!.trim(),
    contentType = contentType!!.trim(),
    sizeBytes = sizeBytes!!,
    dataUrl = dataUrl!!.trim()
  )
}
