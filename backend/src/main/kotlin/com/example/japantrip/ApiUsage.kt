package com.example.japantrip

import java.sql.Date
import java.time.LocalDate
import java.time.ZoneId
import javax.sql.DataSource

object ApiUsageServiceIds {
  const val MapsJavaScript = "maps-js"
  const val Routes = "routes"
  const val PlacesNew = "places-new"
  const val PlacesPhoto = "places-photo"
}

data class ApiUsageEventRequest(
  val serviceId: String? = null,
  val count: Int? = 1
)

data class ApiUsageUpdateRequest(
  val used: Int? = null,
  val limit: Int? = null
)

data class ApiUsageSummaryResponse(
  val periodStart: LocalDate,
  val periodEnd: LocalDate,
  val totalUsed: Int,
  val totalLimit: Int,
  val totalPercentage: Double,
  val services: List<ApiUsageItemResponse>
)

data class ApiUsageItemResponse(
  val serviceId: String,
  val name: String,
  val used: Int,
  val limit: Int,
  val percentage: Double,
  val remaining: Int,
  val status: String
)

data class ApiUsageServiceConfig(
  val serviceId: String,
  val name: String,
  val defaultMonthlyLimit: Int
)

class ApiUsageRepository(
  private val dataSource: DataSource,
  limitConfig: String? = System.getenv("GOOGLE_API_MONTHLY_LIMITS")?.takeIf { it.isNotBlank() }
    ?: System.getenv("GOOGLE_API_DAILY_LIMITS")
) {
  private val limits = parseLimits(limitConfig)
  private val serviceConfigs = listOf(
    ApiUsageServiceConfig(ApiUsageServiceIds.MapsJavaScript, "Maps JavaScript API (Dynamic Maps)", 10_000),
    ApiUsageServiceConfig(ApiUsageServiceIds.Routes, "Routes API (Compute Routes)", 10_000),
    ApiUsageServiceConfig(ApiUsageServiceIds.PlacesNew, "Places API (New Search/Details)", 5_000),
    ApiUsageServiceConfig(ApiUsageServiceIds.PlacesPhoto, "Places API Photo Media", 1_000)
  )

  fun increment(serviceId: String, count: Int = 1) {
    val service = serviceConfigs.firstOrNull { it.serviceId == serviceId } ?: return
    val safeCount = count.coerceIn(1, 1000)
    val sql = """
      INSERT INTO api_usage_daily (usage_date, service_id, service_name, request_count)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (usage_date, service_id) DO UPDATE
      SET
        service_name = EXCLUDED.service_name,
        request_count = api_usage_daily.request_count + EXCLUDED.request_count,
        updated_at = now()
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.setDate(1, Date.valueOf(billingDate()))
        statement.setString(2, service.serviceId)
        statement.setString(3, service.name)
        statement.setInt(4, safeCount)
        statement.executeUpdate()
      }
    }
  }

  fun summary(): ApiUsageSummaryResponse {
    val date = billingDate()
    val periodStart = date.withDayOfMonth(1)
    val periodEnd = date.withDayOfMonth(date.lengthOfMonth())
    val counts = countsForPeriod(periodStart, periodEnd)
    val storedLimits = storedLimits()
    val items = serviceConfigs.map { service ->
      val used = counts[service.serviceId] ?: 0
      val configuredLimit = limits[service.serviceId]
      val defaultLimit = configuredLimit ?: service.defaultMonthlyLimit
      val storedLimit = storedLimits[service.serviceId]
      val limit = if (storedLimit == LegacyDailyDefaultLimit && configuredLimit == null) {
        defaultLimit
      } else {
        storedLimit ?: defaultLimit
      }
      val percentage = if (limit > 0) used.toDouble() / limit.toDouble() * 100 else 0.0

      ApiUsageItemResponse(
        serviceId = service.serviceId,
        name = service.name,
        used = used,
        limit = limit,
        percentage = percentage,
        remaining = (limit - used).coerceAtLeast(0),
        status = usageStatus(percentage)
      )
    }
    val totalUsed = items.sumOf { it.used }
    val totalLimit = items.sumOf { it.limit }
    val totalPercentage = if (totalLimit > 0) totalUsed.toDouble() / totalLimit.toDouble() * 100 else 0.0

    return ApiUsageSummaryResponse(
      periodStart = periodStart,
      periodEnd = periodEnd,
      totalUsed = totalUsed,
      totalLimit = totalLimit,
      totalPercentage = totalPercentage,
      services = items
    )
  }

  fun update(serviceId: String, used: Int, limit: Int): ApiUsageSummaryResponse {
    val service = serviceConfigs.first { it.serviceId == serviceId }
    val safeUsed = used.coerceIn(0, 1_000_000)
    val safeLimit = limit.coerceIn(1, 1_000_000)
    val date = billingDate()
    val periodStart = date.withDayOfMonth(1)
    val periodEnd = date.withDayOfMonth(date.lengthOfMonth())

    val deleteSql = """
      DELETE FROM api_usage_daily
      WHERE service_id = ?
        AND usage_date >= ?
        AND usage_date <= ?
    """.trimIndent()
    val sql = """
      INSERT INTO api_usage_daily (usage_date, service_id, service_name, request_count)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (usage_date, service_id) DO UPDATE
      SET
        service_name = EXCLUDED.service_name,
        request_count = EXCLUDED.request_count,
        updated_at = now()
    """.trimIndent()
    val limitSql = """
      INSERT INTO api_usage_limits (service_id, service_name, daily_limit)
      VALUES (?, ?, ?)
      ON CONFLICT (service_id) DO UPDATE
      SET
        service_name = EXCLUDED.service_name,
        daily_limit = EXCLUDED.daily_limit,
        updated_at = now()
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.autoCommit = false
      try {
        connection.prepareStatement(deleteSql).use { statement ->
          statement.setString(1, service.serviceId)
          statement.setDate(2, Date.valueOf(periodStart))
          statement.setDate(3, Date.valueOf(periodEnd))
          statement.executeUpdate()
        }
        connection.prepareStatement(sql).use { statement ->
          statement.setDate(1, Date.valueOf(date))
          statement.setString(2, service.serviceId)
          statement.setString(3, service.name)
          statement.setInt(4, safeUsed)
          statement.executeUpdate()
        }
        connection.prepareStatement(limitSql).use { statement ->
          statement.setString(1, service.serviceId)
          statement.setString(2, service.name)
          statement.setInt(3, safeLimit)
          statement.executeUpdate()
        }
        connection.commit()
      } catch (cause: Exception) {
        connection.rollback()
        throw cause
      }
    }

    return summary()
  }

  fun validateServiceId(serviceId: String?) = when {
    serviceId.isNullOrBlank() -> "serviceId is required"
    serviceConfigs.none { it.serviceId == serviceId } -> "serviceId is not supported"
    else -> null
  }

  fun validateUpdate(request: ApiUsageUpdateRequest): List<String> {
    val errors = mutableListOf<String>()
    if (request.used == null) errors += "used is required"
    if (request.limit == null) errors += "limit is required"
    if (request.used != null && request.used < 0) errors += "used must be at least 0"
    if (request.limit != null && request.limit <= 0) errors += "limit must be greater than 0"
    if (request.used != null && request.used > 1_000_000) errors += "used must be 1,000,000 or lower"
    if (request.limit != null && request.limit > 1_000_000) errors += "limit must be 1,000,000 or lower"
    return errors
  }

  private fun countsForPeriod(periodStart: LocalDate, periodEnd: LocalDate): Map<String, Int> {
    val sql = """
      SELECT service_id, COALESCE(SUM(request_count), 0)::int AS request_count
      FROM api_usage_daily
      WHERE usage_date >= ?
        AND usage_date <= ?
      GROUP BY service_id
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.setDate(1, Date.valueOf(periodStart))
        statement.setDate(2, Date.valueOf(periodEnd))
        statement.executeQuery().use { rows ->
          val counts = mutableMapOf<String, Int>()
          while (rows.next()) {
            counts[rows.getString("service_id")] = rows.getInt("request_count")
          }
          return counts
        }
      }
    }
  }

  private fun storedLimits(): Map<String, Int> {
    val sql = """
      SELECT service_id, daily_limit
      FROM api_usage_limits
    """.trimIndent()

    dataSource.connection.use { connection ->
      connection.prepareStatement(sql).use { statement ->
        statement.executeQuery().use { rows ->
          val values = mutableMapOf<String, Int>()
          while (rows.next()) {
            values[rows.getString("service_id")] = rows.getInt("daily_limit")
          }
          return values
        }
      }
    }
  }

  private fun billingDate() = LocalDate.now(ZoneId.of("America/Los_Angeles"))

  private fun usageStatus(percentage: Double) = when {
    percentage >= 100 -> "exceeded"
    percentage >= 85 -> "danger"
    percentage >= 70 -> "warning"
    else -> "normal"
  }

  private fun parseLimits(value: String?): Map<String, Int> {
    if (value.isNullOrBlank()) return emptyMap()

    return value.split(",")
      .mapNotNull { raw ->
        val parts = raw.trim().split("=", limit = 2)
        if (parts.size != 2) return@mapNotNull null
        val limit = parts[1].trim().toIntOrNull()?.takeIf { it > 0 } ?: return@mapNotNull null
        parts[0].trim() to limit
      }
      .toMap()
  }

  private companion object {
    const val LegacyDailyDefaultLimit = 100
  }
}
