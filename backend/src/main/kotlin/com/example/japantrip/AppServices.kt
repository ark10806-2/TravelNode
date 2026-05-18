package com.example.japantrip

data class AppServices(
  val database: RestaurantDatabase,
  val restaurantRepository: RestaurantRepository,
  val restaurantPhotoRepository: RestaurantPhotoRepository,
  val routeCacheRepository: RouteCacheRepository,
  val scheduleRepository: ScheduleRepository,
  val todoRepository: TodoRepository,
  val reservationRepository: ReservationRepository,
  val apiUsageRepository: ApiUsageRepository,
  val categoryRepository: CategoryRepository,
  val authRepository: AuthRepository,
  val googleMapsPreviewService: GoogleMapsPreviewService,
  val googleMapsListSyncService: GoogleMapsListSyncService,
  val googleMapsPhotoService: GoogleMapsPhotoService
) {
  fun initialize() {
    database.initialize()
    authRepository.ensureInitialized()
  }

  companion object {
    fun fromEnv(): AppServices {
      val database = RestaurantDatabase.fromEnv()
      val apiUsageRepository = ApiUsageRepository(database.dataSource)

      return AppServices(
        database = database,
        restaurantRepository = RestaurantRepository(database.dataSource),
        restaurantPhotoRepository = RestaurantPhotoRepository(database.dataSource),
        routeCacheRepository = RouteCacheRepository(database.dataSource),
        scheduleRepository = ScheduleRepository(database.dataSource),
        todoRepository = TodoRepository(database.dataSource),
        reservationRepository = ReservationRepository(database.dataSource),
        apiUsageRepository = apiUsageRepository,
        categoryRepository = CategoryRepository(database.dataSource),
        authRepository = AuthRepository(database.dataSource),
        googleMapsPreviewService = GoogleMapsPreviewService(apiUsageRepository = apiUsageRepository),
        googleMapsListSyncService = GoogleMapsListSyncService(
          restaurantRepository = RestaurantRepository(database.dataSource),
          apiUsageRepository = apiUsageRepository
        ),
        googleMapsPhotoService = GoogleMapsPhotoService(apiUsageRepository = apiUsageRepository)
      )
    }
  }
}
