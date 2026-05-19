package com.example.japantrip

import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Duration
import java.time.Instant
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
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.setString(1, fromPlaceId)
        statement.setString(2, toPlaceId)
        statement.setInt(3, RouteCalculationVersion)
        statement.executeQuery().use { rows ->
          if (!rows.next()) return null
          val routeLeg = rows.toRouteLeg()
          return if (routeLeg.hasAnyMode()) routeLeg else null
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
        driving_updated_at,
        transit_status,
        transit_duration_label,
        transit_distance_label,
        transit_error,
        transit_updated_at,
        walking_status,
        walking_duration_label,
        walking_distance_label,
        walking_error,
        walking_updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (from_place_key, to_place_key) DO UPDATE
      SET
        calculation_version = EXCLUDED.calculation_version,
        driving_status = CASE WHEN EXCLUDED.driving_status IS NOT NULL THEN EXCLUDED.driving_status WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.driving_status ELSE NULL END,
        driving_duration_label = CASE WHEN EXCLUDED.driving_status IS NOT NULL THEN EXCLUDED.driving_duration_label WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.driving_duration_label ELSE NULL END,
        driving_distance_label = CASE WHEN EXCLUDED.driving_status IS NOT NULL THEN EXCLUDED.driving_distance_label WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.driving_distance_label ELSE NULL END,
        driving_error = CASE WHEN EXCLUDED.driving_status IS NOT NULL THEN EXCLUDED.driving_error WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.driving_error ELSE NULL END,
        driving_updated_at = CASE WHEN EXCLUDED.driving_status IS NOT NULL THEN EXCLUDED.driving_updated_at WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.driving_updated_at ELSE NULL END,
        transit_status = CASE WHEN EXCLUDED.transit_status IS NOT NULL THEN EXCLUDED.transit_status WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.transit_status ELSE NULL END,
        transit_duration_label = CASE WHEN EXCLUDED.transit_status IS NOT NULL THEN EXCLUDED.transit_duration_label WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.transit_duration_label ELSE NULL END,
        transit_distance_label = CASE WHEN EXCLUDED.transit_status IS NOT NULL THEN EXCLUDED.transit_distance_label WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.transit_distance_label ELSE NULL END,
        transit_error = CASE WHEN EXCLUDED.transit_status IS NOT NULL THEN EXCLUDED.transit_error WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.transit_error ELSE NULL END,
        transit_updated_at = CASE WHEN EXCLUDED.transit_status IS NOT NULL THEN EXCLUDED.transit_updated_at WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.transit_updated_at ELSE NULL END,
        walking_status = CASE WHEN EXCLUDED.walking_status IS NOT NULL THEN EXCLUDED.walking_status WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.walking_status ELSE NULL END,
        walking_duration_label = CASE WHEN EXCLUDED.walking_status IS NOT NULL THEN EXCLUDED.walking_duration_label WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.walking_duration_label ELSE NULL END,
        walking_distance_label = CASE WHEN EXCLUDED.walking_status IS NOT NULL THEN EXCLUDED.walking_distance_label WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.walking_distance_label ELSE NULL END,
        walking_error = CASE WHEN EXCLUDED.walking_status IS NOT NULL THEN EXCLUDED.walking_error WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.walking_error ELSE NULL END,
        walking_updated_at = CASE WHEN EXCLUDED.walking_status IS NOT NULL THEN EXCLUDED.walking_updated_at WHEN route_cache_entries.calculation_version = EXCLUDED.calculation_version THEN route_cache_entries.walking_updated_at ELSE NULL END,
        updated_at = now()
      RETURNING *
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.setString(1, values.fromPlaceId)
        statement.setString(2, values.toPlaceId)
        statement.setInt(3, RouteCalculationVersion)
        statement.bindMode(4, values.driving)
        statement.bindMode(9, values.transit)
        statement.bindMode(14, values.walking)
        statement.executeQuery().use { rows ->
          if (rows.next()) return rows.toRouteLeg()
          error("Route cache upsert returned no row")
        }
      }
    }
  }

  private fun PreparedStatement.bindMode(startIndex: Int, values: RouteModeLegValues?) {
    if (values == null) {
      setString(startIndex, null)
      setString(startIndex + 1, null)
      setString(startIndex + 2, null)
      setString(startIndex + 3, null)
      setTimestamp(startIndex + 4, null)
      return
    }

    setString(startIndex, values.status)
    setString(startIndex + 1, values.durationLabel)
    setString(startIndex + 2, values.distanceLabel)
    setString(startIndex + 3, values.error)
    setTimestamp(startIndex + 4, Timestamp.from(Instant.now()))
  }

  private fun ResultSet.toRouteLeg() = RouteLegResponse(
    driving = toModeLeg("driving", DrivingCacheTtl),
    transit = toModeLeg("transit", TransitCacheTtl),
    walking = toModeLeg("walking", WalkingCacheTtl)
  )

  private fun ResultSet.toModeLeg(mode: String, ttl: Duration): RouteModeLegResponse? {
    val status = getString("${mode}_status") ?: return null
    if (status != "ready") return null

    val updatedAt = getTimestamp("${mode}_updated_at") ?: getTimestamp("updated_at") ?: return null
    if (updatedAt.toInstant().isBefore(Instant.now().minus(ttl))) return null

    return RouteModeLegResponse(
      status = status,
      durationLabel = getString("${mode}_duration_label") ?: return null,
      distanceLabel = getString("${mode}_distance_label") ?: return null,
      error = getString("${mode}_error"),
      updatedAt = updatedAt.toInstant().toString()
    )
  }

  private fun RouteLegResponse.hasAnyMode() =
    driving != null || transit != null || walking != null

  private companion object {
    const val RouteCalculationVersion = 6
    val DrivingCacheTtl: Duration = Duration.ofHours(6)
    val TransitCacheTtl: Duration = Duration.ofHours(2)
    val WalkingCacheTtl: Duration = Duration.ofDays(7)
  }
}
