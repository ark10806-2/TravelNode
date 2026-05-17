package com.example.japantrip

import java.sql.ResultSet
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
        s.id AS stop_id,
        s.restaurant_id AS place_id,
        s.selected_route_mode AS selected_route_mode
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
              selectedReturnRouteMode = day.selectedReturnRouteMode
            )
          }
        }
      }
    }
  }

  fun replaceAll(request: ScheduleSaveRequest): List<ScheduleDayResponse> {
    val requestedDays = request.days.orEmpty()
    val insertDaySql = """
      INSERT INTO schedule_days (id, sort_order, selected_return_route_mode)
      VALUES (?, ?, ?)
    """.trimIndent()
    val insertStopSql = """
      INSERT INTO schedule_stops (id, day_id, restaurant_id, sort_order, selected_route_mode)
      VALUES (?, ?, ?, ?, ?)
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
    selectedRouteMode = getString("selected_route_mode")
  )

  private data class ScheduleDayAccumulator(
    val selectedReturnRouteMode: String?,
    val stops: MutableList<ScheduleStopResponse>
  )
}
