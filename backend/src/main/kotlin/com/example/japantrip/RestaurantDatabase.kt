package com.example.japantrip

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import java.sql.Connection

class RestaurantDatabase private constructor(
  val dataSource: HikariDataSource
) {
  companion object {
    fun fromEnv(): RestaurantDatabase {
      val jdbcUrl = System.getenv("JDBC_DATABASE_URL")
        ?: System.getenv("SPRING_DATASOURCE_URL")
        ?: "jdbc:postgresql://localhost:5432/japan_trip"
      val username = System.getenv("JDBC_DATABASE_USERNAME")
        ?: System.getenv("SPRING_DATASOURCE_USERNAME")
        ?: "japan"
      val password = System.getenv("JDBC_DATABASE_PASSWORD")
        ?: System.getenv("SPRING_DATASOURCE_PASSWORD")
        ?: "japan"

      val config = HikariConfig().apply {
        this.jdbcUrl = jdbcUrl
        this.username = username
        this.password = password
        maximumPoolSize = 5
        poolName = "restaurant-pool"
      }

      return RestaurantDatabase(HikariDataSource(config))
    }
  }

  fun initialize() {
    dataSource.connection.use { connection ->
      connection.autoCommit = false
      connection.executeResource("/schema.sql")
      connection.executeResource("/data.sql")
      connection.commit()
    }
  }

  fun close() {
    dataSource.close()
  }
}

private fun Connection.executeResource(path: String) {
  val sql = RestaurantDatabase::class.java.getResource(path)?.readText()
    ?: error("Missing SQL resource: $path")
  createStatement().use { statement ->
    statement.execute(sql)
  }
}
