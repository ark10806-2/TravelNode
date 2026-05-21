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
  val tripBookletPdfService: TripBookletPdfService,
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
      val restaurantRepository = RestaurantRepository(database.dataSource)
      val restaurantPhotoRepository = RestaurantPhotoRepository(database.dataSource)
      val routeCacheRepository = RouteCacheRepository(database.dataSource)
      val scheduleRepository = ScheduleRepository(database.dataSource)
      val todoRepository = TodoRepository(database.dataSource)
      val reservationRepository = ReservationRepository(database.dataSource)
      val apiUsageRepository = ApiUsageRepository(database.dataSource)
      val categoryRepository = CategoryRepository(database.dataSource)
      val authRepository = AuthRepository(database.dataSource)

      return AppServices(
        database = database,
        restaurantRepository = restaurantRepository,
        restaurantPhotoRepository = restaurantPhotoRepository,
        routeCacheRepository = routeCacheRepository,
        scheduleRepository = scheduleRepository,
        todoRepository = todoRepository,
        reservationRepository = reservationRepository,
        apiUsageRepository = apiUsageRepository,
        categoryRepository = categoryRepository,
        authRepository = authRepository,
        tripBookletPdfService = TripBookletPdfService(
          categoryRepository = categoryRepository,
          restaurantRepository = restaurantRepository,
          restaurantPhotoRepository = restaurantPhotoRepository,
          scheduleRepository = scheduleRepository,
          reservationRepository = reservationRepository,
          todoRepository = todoRepository
        ),
        googleMapsPreviewService = GoogleMapsPreviewService(apiUsageRepository = apiUsageRepository),
        googleMapsListSyncService = GoogleMapsListSyncService(
          restaurantRepository = restaurantRepository,
          apiUsageRepository = apiUsageRepository
        ),
        googleMapsPhotoService = GoogleMapsPhotoService(apiUsageRepository = apiUsageRepository)
      )
    }
  }
}
