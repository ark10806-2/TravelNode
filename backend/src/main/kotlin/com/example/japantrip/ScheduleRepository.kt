package com.example.japantrip

import java.sql.ResultSet
import java.sql.Types
import java.util.UUID
import javax.sql.DataSource

class ScheduleRepository(
  private val dataSource: DataSource
) {
  fun findAll(): List<ScheduleDayResponse> {
    val sql = """
      SELECT
        d.id AS day_id,
        d.selected_return_route_mode AS selected_return_route_mode,
        d.departure_time_minutes AS day_departure_time_minutes,
        d.locked_return_route AS locked_return_route,
        d.hotel_place_id AS hotel_place_id,
        s.id AS stop_id,
        s.restaurant_id AS place_id,
        s.selected_route_mode AS selected_route_mode,
        s.departure_time_minutes AS stop_departure_time_minutes,
        s.locked_from_previous AS locked_from_previous
      FROM schedule_days d
      LEFT JOIN schedule_stops s ON s.day_id = d.id
      ORDER BY d.sort_order, s.sort_order
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.executeQuery().use { rows ->
          val days = linkedMapOf<String, ScheduleDayAccumulator>()
          while (rows.next()) {
            val dayId = rows.getString("day_id")
            val day = days.getOrPut(dayId) {
              ScheduleDayAccumulator(
                selectedReturnRouteMode = rows.getString("selected_return_route_mode"),
                departureTimeMinutes = rows.getNullableInt("day_departure_time_minutes"),
                lockedReturnRoute = rows.getBoolean("locked_return_route"),
                hotelPlaceId = rows.getObject("hotel_place_id", UUID::class.java)?.toString(),
                stops = mutableListOf()
              )
            }
            val stopId = rows.getString("stop_id")
            if (stopId != null) {
              day.stops += rows.toStop()
            }
          }

          return days.map { (dayId, day) ->
            ScheduleDayResponse(
              id = dayId,
              stops = day.stops,
              selectedReturnRouteMode = day.selectedReturnRouteMode,
              hotelPlaceId = day.hotelPlaceId,
              departureTimeMinutes = day.departureTimeMinutes,
              lockedReturnRoute = day.lockedReturnRoute
            )
          }
        }
      }
    }
  }

  fun replaceAll(request: ScheduleSaveRequest): List<ScheduleDayResponse> {
    val requestedDays = request.days.orEmpty()
    val insertDaySql = """
      INSERT INTO schedule_days (id, sort_order, selected_return_route_mode, hotel_place_id, departure_time_minutes, locked_return_route)
      VALUES (?, ?, ?, ?, ?, ?)
    """.trimIndent()
    val insertStopSql = """
      INSERT INTO schedule_stops (id, day_id, restaurant_id, sort_order, selected_route_mode, departure_time_minutes, locked_from_previous)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.autoCommit = false
      try {
        connection.createStatement().use { statement ->
          statement.executeUpdate("DELETE FROM schedule_stops")
          statement.executeUpdate("DELETE FROM schedule_days")
        }

        connection.prepareStatement(insertDaySql).use { statement ->
          requestedDays.forEachIndexed { dayIndex, day ->
            statement.setString(1, day.id!!.trim())
            statement.setInt(2, dayIndex)
            statement.setString(3, day.selectedReturnRouteMode?.trim()?.takeIf { it.isNotBlank() })
            val hotelPlaceId = day.hotelPlaceId?.trim()?.takeIf { it.isNotBlank() }
            if (hotelPlaceId == null) {
              statement.setNull(4, Types.OTHER)
            } else {
              statement.setObject(4, UUID.fromString(hotelPlaceId))
            }
            if (day.departureTimeMinutes == null) {
              statement.setNull(5, Types.INTEGER)
            } else {
              statement.setInt(5, day.departureTimeMinutes)
            }
            statement.setBoolean(6, day.lockedReturnRoute == true)
            statement.addBatch()
          }
          statement.executeBatch()
        }

        connection.prepareStatement(insertStopSql).use { statement ->
          requestedDays.forEach { day ->
            day.stops.orEmpty().forEachIndexed { stopIndex, stop ->
              statement.setString(1, stop.id!!.trim())
              statement.setString(2, day.id!!.trim())
              statement.setObject(3, UUID.fromString(stop.placeId!!.trim()))
              statement.setInt(4, stopIndex)
              statement.setString(5, stop.selectedRouteMode?.trim()?.takeIf { it.isNotBlank() })
              if (stop.departureTimeMinutes == null) {
                statement.setNull(6, Types.INTEGER)
              } else {
                statement.setInt(6, stop.departureTimeMinutes)
              }
              statement.setBoolean(7, stop.lockedFromPrevious == true)
              statement.addBatch()
            }
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

  private fun ResultSet.toStop() = ScheduleStopResponse(
    id = getString("stop_id"),
    placeId = getObject("place_id", UUID::class.java).toString(),
    selectedRouteMode = getString("selected_route_mode"),
    departureTimeMinutes = getNullableInt("stop_departure_time_minutes"),
    lockedFromPrevious = getBoolean("locked_from_previous")
  )

  private fun ResultSet.getNullableInt(column: String): Int? {
    val value = getInt(column)
    return if (wasNull()) null else value
  }

  private data class ScheduleDayAccumulator(
    val selectedReturnRouteMode: String?,
    val hotelPlaceId: String?,
    val departureTimeMinutes: Int?,
    val lockedReturnRoute: Boolean,
    val stops: MutableList<ScheduleStopResponse>
  )
}
