package com.example.japantrip

import java.sql.PreparedStatement
import java.sql.ResultSet
import javax.sql.DataSource

class RouteCacheRepository(
  private val dataSource: DataSource
) {
  fun find(fromPlaceId: String, toPlaceId: String): RouteLegResponse? {
    val sql = """
      SELECT *
      FROM route_cache_entries
      WHERE from_place_key = ?
        AND to_place_key = ?
        AND calculation_version = ?
        AND driving_status = 'ready'
        AND transit_status = 'ready'
        AND walking_status = 'ready'
        AND updated_at > now() - interval '10 minutes'
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.setString(1, fromPlaceId)
        statement.setString(2, toPlaceId)
        statement.setInt(3, RouteCalculationVersion)
        statement.executeQuery().use { rows ->
          return if (rows.next()) rows.toRouteLeg() else null
        }
      }
    }
  }

  fun upsert(values: RouteCacheValues): RouteLegResponse {
    val sql = """
      INSERT INTO route_cache_entries (
        from_place_key,
        to_place_key,
        calculation_version,
        driving_status,
        driving_duration_label,
        driving_distance_label,
        driving_error,
        transit_status,
        transit_duration_label,
        transit_distance_label,
        transit_error,
        walking_status,
        walking_duration_label,
        walking_distance_label,
        walking_error
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (from_place_key, to_place_key) DO UPDATE
      SET
        calculation_version = EXCLUDED.calculation_version,
        driving_status = EXCLUDED.driving_status,
        driving_duration_label = EXCLUDED.driving_duration_label,
        driving_distance_label = EXCLUDED.driving_distance_label,
        driving_error = EXCLUDED.driving_error,
        transit_status = EXCLUDED.transit_status,
        transit_duration_label = EXCLUDED.transit_duration_label,
        transit_distance_label = EXCLUDED.transit_distance_label,
        transit_error = EXCLUDED.transit_error,
        walking_status = EXCLUDED.walking_status,
        walking_duration_label = EXCLUDED.walking_duration_label,
        walking_distance_label = EXCLUDED.walking_distance_label,
        walking_error = EXCLUDED.walking_error,
        updated_at = now()
      RETURNING *
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.setString(1, values.fromPlaceId)
        statement.setString(2, values.toPlaceId)
        statement.setInt(3, RouteCalculationVersion)
        statement.bindMode(4, values.driving)
        statement.bindMode(8, values.transit)
        statement.bindMode(12, values.walking)
        statement.executeQuery().use { rows ->
          if (rows.next()) return rows.toRouteLeg()
          error("Route cache upsert returned no row")
        }
      }
    }
  }

  private fun PreparedStatement.bindMode(startIndex: Int, values: RouteModeLegValues) {
    setString(startIndex, values.status)
    setString(startIndex + 1, values.durationLabel)
    setString(startIndex + 2, values.distanceLabel)
    setString(startIndex + 3, values.error)
  }

  private fun ResultSet.toRouteLeg() = RouteLegResponse(
    driving = toModeLeg("driving"),
    transit = toModeLeg("transit"),
    walking = toModeLeg("walking")
  )

  private fun ResultSet.toModeLeg(mode: String) = RouteModeLegResponse(
    status = getString("${mode}_status"),
    durationLabel = getString("${mode}_duration_label"),
    distanceLabel = getString("${mode}_distance_label"),
    error = getString("${mode}_error")
  )

  private companion object {
    const val RouteCalculationVersion = 5
  }
}
