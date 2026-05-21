package com.example.japantrip

import java.awt.Color
import java.awt.Font
import java.awt.BasicStroke
import java.awt.Graphics2D
import java.awt.RenderingHints
import java.awt.geom.Line2D
import java.awt.geom.Rectangle2D
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.min
import javax.imageio.ImageIO
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.common.PDRectangle
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject

class TripBookletPdfService(
  private val categoryRepository: CategoryRepository,
  private val restaurantRepository: RestaurantRepository,
  private val restaurantPhotoRepository: RestaurantPhotoRepository,
  private val scheduleRepository: ScheduleRepository,
  private val reservationRepository: ReservationRepository,
  private val todoRepository: TodoRepository
) {
  fun generate(): ByteArray {
    val snapshot = TripBookletData(
      generatedAt = LocalDateTime.now(),
      categories = categoryRepository.findAll(),
      places = restaurantRepository.findAll(category = null, travelMode = null),
      scheduleDays = scheduleRepository.findAll(),
      reservations = reservationRepository.findAll(),
      todos = todoRepository.findAll()
    )
    val photos = loadCachedPhotos(snapshot.places)

    PDDocument().use { document ->
      val fonts = BookletFonts.load()
      val renderer = BookletPdfRenderer(document, fonts, snapshot, photos)
      renderer.render()

      return ByteArrayOutputStream().use { output ->
        document.save(output)
        output.toByteArray()
      }
    }
  }

  private fun loadCachedPhotos(places: List<RestaurantResponse>): Map<String, ByteArray> {
    return places.mapNotNull { place ->
      val firstPhoto = restaurantPhotoRepository.findByRestaurantId(place.id).firstOrNull() ?: return@mapNotNull null
      val image = restaurantPhotoRepository.findImage(place.id, firstPhoto.id) ?: return@mapNotNull null
      place.id to image.imageBytes
    }.toMap()
  }
}

private data class TripBookletData(
  val generatedAt: LocalDateTime,
  val categories: List<CategoryResponse>,
  val places: List<RestaurantResponse>,
  val scheduleDays: List<ScheduleDayResponse>,
  val reservations: List<ReservationResponse>,
  val todos: TodoListResponse
)

private data class BookletFonts(
  val regular: Font,
  val bold: Font
) {
  companion object {
    fun load(): BookletFonts {
      val regularFile = findFontFile(
        envName = "TRAVEL_NODE_PDF_FONT",
        candidates = listOf(
          "/usr/share/fonts/noto/NotoSansCJK-Regular.ttc",
          "/usr/share/fonts/noto/NotoSerifCJK-Regular.ttc",
          "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
          "/System/Library/Fonts/AppleSDGothicNeo.ttc",
          "/usr/share/fonts/droid-nonlatin/DroidSansFallbackFull.ttf",
          "/usr/share/fonts/droid-nonlatin/DroidSansFallback.ttf"
        )
      )
      val boldFile = findFontFile(
        envName = "TRAVEL_NODE_PDF_BOLD_FONT",
        candidates = listOf(
          "/usr/share/fonts/noto/NotoSansCJK-Bold.ttc",
          "/usr/share/fonts/noto/NotoSerifCJK-Bold.ttc",
          "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
          "/System/Library/Fonts/AppleSDGothicNeo.ttc",
          "/usr/share/fonts/droid-nonlatin/DroidSansFallbackFull.ttf",
          "/usr/share/fonts/droid-nonlatin/DroidSansFallback.ttf",
          regularFile.absolutePath
        )
      )

      return BookletFonts(
        regular = loadAwtFont(regularFile, Font.PLAIN),
        bold = loadAwtFont(boldFile, Font.BOLD)
      )
    }

    private fun findFontFile(envName: String, candidates: List<String>): File {
      val configured = System.getenv(envName)?.trim()?.takeIf { it.isNotBlank() }
      val allCandidates = listOfNotNull(configured) + candidates
      return allCandidates.map(::File).firstOrNull { it.exists() && it.isFile }
        ?: error("$envName or a CJK font must be available to generate Korean PDF")
    }

    private fun loadAwtFont(file: File, style: Int): Font {
      return runCatching {
        val fonts = Font.createFonts(file)
        val preferredFont = fonts.firstOrNull { font ->
          font.fontName.contains("KR", ignoreCase = true) && font.canDisplayUpTo(KOREAN_FONT_SAMPLE) == -1
        } ?: fonts.firstOrNull { font ->
          font.canDisplayUpTo(KOREAN_FONT_SAMPLE) == -1
        } ?: fonts.firstOrNull() ?: error("No font loaded from ${file.absolutePath}")

        preferredFont.deriveFont(style, 12f)
      }.getOrElse {
        Font("SansSerif", style, 12)
      }
    }

    private const val KOREAN_FONT_SAMPLE = "나의 여행 책자 예약 장소 체크리스트 東京 日本 ABC 123"
  }
}

private class BookletPdfRenderer(
  private val document: PDDocument,
  private val fonts: BookletFonts,
  private val data: TripBookletData,
  private val photosByPlaceId: Map<String, ByteArray>
) {
  private var pageImage: BufferedImage? = null
  private var graphics: Graphics2D? = null
  private var y = 0f
  private var pageNumber = 0

  private val pageWidth = PDRectangle.A4.width
  private val pageHeight = PDRectangle.A4.height
  private val renderScale = 2f

  private val placesById = (data.places + defaultHotelPlace()).associateBy { it.id }

  fun render() {
    renderCover()
    renderSchedule()
    renderReservations()
    renderPlaces()
    renderTodos()
    closePage()
  }

  private fun renderCover() {
    startPage(Colors.Cream)
    drawBrand()
    val coverPhoto = data.places.firstNotNullOfOrNull { place -> photosByPlaceId[place.id] }

    drawText("TravelNode Guide", 54f, 730f, 12f, fonts.bold, Colors.Rose)
    drawWrappedText(
      text = "나의\n여행 책자",
      x = 54f,
      width = 270f,
      size = 44f,
      lineHeight = 48f,
      font = fonts.bold,
      color = Colors.Ink,
      yOverride = 680f
    )
    drawWrappedText(
      text = "일정, 장소, 예약, 체크리스트를 오프라인에서도 안정적으로 볼 수 있도록 서버에서 A4 고정 레이아웃으로 생성했습니다.",
      x = 56f,
      width = 260f,
      size = 11f,
      lineHeight = 17f,
      color = Colors.Muted,
      maxLines = 4,
      yOverride = 544f
    )

    if (coverPhoto != null) {
      drawImage(coverPhoto, 350f, 482f, 170f, 210f)
    } else {
      drawFilledRect(350f, 482f, 170f, 210f, Colors.Sand)
      drawText("Travel Preview", 390f, 585f, 11f, fonts.bold, Colors.Muted)
    }

    val metrics = listOf(
      "일정" to "${data.scheduleDays.size} DAY",
      "장소" to "${data.places.size}곳",
      "예약" to "${data.reservations.size}개",
      "할 일" to "${countDoneTodos(data.todos)}/${countTodos(data.todos)}"
    )
    metrics.forEachIndexed { index, metric ->
      val x = 54f + index * 122f
      drawCard(x, 130f, 108f, 72f, Colors.White)
      drawText(metric.first, x + 12f, 174f, 9f, fonts.bold, Colors.Muted)
      drawText(metric.second, x + 12f, 151f, 18f, fonts.bold, Colors.Ink)
    }

    drawText("저장 기준 ${formatGeneratedAt(data.generatedAt)}", 54f, 76f, 9f, fonts.regular, Colors.Muted)
    drawPageFooter("Cover")
  }

  private fun renderSchedule() {
    if (data.scheduleDays.isEmpty()) {
      startSection("01", "DAY별 일정", "숙소 출발과 도착을 기준으로 방문 순서를 정리했습니다.")
      drawEmpty("등록된 일정이 없습니다.")
      return
    }

    data.scheduleDays.forEachIndexed { dayIndex, day ->
      val hotel = hotelFor(day)
      startSection(
        section = "01",
        title = "DAY ${dayIndex + 1} 일정",
        subtitle = listOf(
          formatTravelDate(day.travelDate),
          "출발 ${formatDepartureTime(day.departureTimeMinutes)}",
          "기준 숙소 ${hotel.name}"
        ).joinToString(" · ")
      )

      drawCard(42f, y - 80f, 511f, 80f, Colors.Ink)
      drawText("DAY ${dayIndex + 1}", 62f, y - 31f, 20f, fonts.bold, Colors.White)
      drawText(formatTravelDate(day.travelDate), 62f, y - 54f, 10f, fonts.regular, Colors.WhiteMuted)
      drawText("기준 숙소 ${hotel.name}", 360f, y - 31f, 9f, fonts.regular, Colors.WhiteMuted)
      drawText("출발 ${formatDepartureTime(day.departureTimeMinutes)}", 360f, y - 49f, 9f, fonts.regular, Colors.WhiteMuted)
      y -= 104f

      drawRouteLine("출발", hotel, null, null, false)
      day.stops.forEachIndexed { stopIndex, stop ->
        val place = placesById[stop.placeId] ?: return@forEachIndexed
        drawRouteLine(
          label = "${stopIndex + 1}",
          place = place,
          mode = stop.selectedRouteMode,
          departureTimeMinutes = stop.departureTimeMinutes,
          locked = stop.lockedFromPrevious
        )
      }
      drawRouteLine("도착", hotel, day.selectedReturnRouteMode, null, day.lockedReturnRoute)

      val dayReservations = data.reservations.filter { it.dayIndex == dayIndex }
      val dayTodos = data.todos.days.find { it.dayIndex == dayIndex }?.items.orEmpty()
      drawMiniList("이 DAY 예약", dayReservations.map { it.title }, 42f, y - 92f, 248f, 92f)
      drawMiniList("이 DAY 할 일", dayTodos.map { todoLabel(it) }, 305f, y - 92f, 248f, 92f)
      y -= 112f
      drawPageFooter("DAY ${dayIndex + 1}")
    }
  }

  private fun renderReservations() {
    startSection("02", "예약/티켓", "예약번호, 플랫폼, 연결 장소, 첨부파일 이름을 함께 확인합니다.")
    val reservations = data.reservations.sortedWith(
      compareBy<ReservationResponse> { it.completed }
        .thenBy { it.dayIndex ?: 9999 }
        .thenBy { it.timeLabel }
        .thenBy { it.title }
    )

    if (reservations.isEmpty()) {
      drawEmpty("등록된 예약/티켓이 없습니다.")
      return
    }

    reservations.forEach { reservation ->
      ensureSpace(118f)
      val place = reservation.placeId?.let(placesById::get)
      val cardTop = y
      drawCard(42f, y - 108f, 511f, 108f, Colors.Soft)
      drawText(reservationTypeLabel(reservation.reservationType), 58f, cardTop - 21f, 8f, fonts.bold, Colors.Rose)
      drawWrappedText(reservation.title, 58f, 315f, 14f, 18f, fonts.bold, Colors.Ink, maxLines = 2, yOverride = cardTop - 43f)
      drawText(formatDayLabel(reservation.dayIndex), 456f, cardTop - 21f, 9f, fonts.bold, Colors.Muted)

      val detail = listOfNotNull(
        reservation.timeLabel.takeIf { it.isNotBlank() }?.let { "시간 $it" },
        reservation.bookingPlatform.takeIf { it.isNotBlank() }?.let { "플랫폼 $it" },
        reservation.referenceNumber.takeIf { it.isNotBlank() }?.let { "예약번호 $it" },
        place?.let { "장소 ${it.name}" }
      ).joinToString(" · ")
      var detailY = drawWrappedText(detail, 58f, 478f, 9f, 13f, color = Colors.Muted, maxLines = 2, yOverride = cardTop - 64f)

      val notes = plainMarkdown(reservation.notes).takeIf { it.isNotBlank() }
      if (notes != null) {
        detailY = drawWrappedText("메모 $notes", 58f, 478f, 9f, 13f, color = Colors.Muted, maxLines = 2, yOverride = detailY - 2f)
      }
      if (place?.description?.isNotBlank() == true) {
        detailY = drawWrappedText("장소 설명 ${plainMarkdown(place.description)}", 58f, 478f, 9f, 13f, color = Colors.Muted, maxLines = 2, yOverride = detailY - 2f)
      }
      val attachmentNames = reservation.attachments.map { it.fileName }.takeIf { it.isNotEmpty() }
      if (attachmentNames != null) {
        drawWrappedText("첨부 ${attachmentNames.joinToString(", ")}", 58f, 478f, 8f, 12f, color = Colors.LightText, maxLines = 1, yOverride = detailY - 2f)
      }
      y -= 122f
    }
    drawPageFooter("Reservations")
  }

  private fun renderPlaces() {
    val grouped = data.categories
      .sortedWith(compareBy<CategoryResponse> { it.sortOrder }.thenBy { it.label })
      .map { category -> category to data.places.filter { it.category == category.id } }
      .filter { it.second.isNotEmpty() }

    if (grouped.isEmpty()) {
      startSection("03", "장소 모음", "카테고리별 장소, 대표 항목, 주소, 메모를 한 번에 볼 수 있습니다.")
      drawEmpty("등록된 장소가 없습니다.")
      return
    }

    grouped.forEach { (category, places) ->
      startSection("03", "장소 · ${category.label}", "${places.size}곳의 대표 항목, 설명, 주소, 메모를 정리했습니다.")
      var column = 0
      places.forEach { place ->
        val x = if (column == 0) 42f else 305f
        if (y - 170f < 62f) {
          startSection("03", "장소 · ${category.label}", "계속")
          column = 0
        }
        drawPlaceCard(place, category, x, y)
        if (column == 0) {
          column = 1
        } else {
          column = 0
          y -= 184f
        }
      }
      if (column == 1) y -= 184f
      drawPageFooter("Places")
    }
  }

  private fun renderTodos() {
    val groups = buildList {
      add("여행 전 체크리스트" to data.todos.before)
      data.todos.days.sortedBy { it.dayIndex }.forEach { day ->
        add(formatDayLabel(day.dayIndex) to day.items)
      }
      data.todos.custom.forEach { checklist ->
        add(checklist.title to checklist.items)
      }
      add("여행 후 체크리스트" to data.todos.after)
    }.filter { it.second.isNotEmpty() }

    startSection("04", "체크리스트", "여행 전, DAY별, 커스텀, 여행 후 체크리스트를 모았습니다.")
    if (groups.isEmpty()) {
      drawEmpty("등록된 체크리스트가 없습니다.")
      return
    }

    groups.forEach { (title, items) ->
      ensureSpace(70f)
      drawText(title, 42f, y, 14f, fonts.bold, Colors.Ink)
      y -= 20f
      items.forEach { item ->
        ensureSpace(18f)
        drawText(if (item.done) "☑" else "□", 48f, y, 10f, fonts.regular, Colors.Muted)
        drawWrappedText(item.text, 66f, 470f, 10f, 14f, color = if (item.done) Colors.LightText else Colors.Muted, maxLines = 2)
        y -= 16f
      }
      y -= 14f
    }
    drawPageFooter("Checklist")
  }

  private fun drawRouteLine(
    label: String,
    place: RestaurantResponse,
    mode: String?,
    departureTimeMinutes: Int?,
    locked: Boolean
  ) {
    ensureSpace(92f)
    drawFilledRect(46f, y - 28f, 28f, 28f, Colors.White)
    drawText(label, 52f, y - 18f, 8f, fonts.bold, Colors.Muted)
    drawCard(84f, y - 78f, 469f, 78f, Colors.White)
    drawWrappedText(place.name, 100f, 315f, 12f, 15f, fonts.bold, Colors.Ink, maxLines = 2, yOverride = y - 20f)
    val routeMeta = listOfNotNull(
      mode?.let(::routeModeLabel),
      departureTimeMinutes?.let { "출발 ${formatDepartureTime(it)}" },
      if (locked) "구간 고정" else null
    ).joinToString(" · ")
    if (routeMeta.isNotBlank()) drawText(routeMeta, 420f, y - 19f, 8f, fonts.bold, Colors.LightText)
    drawWrappedText(place.address, 100f, 420f, 8f, 11f, color = Colors.LightText, maxLines = 1, yOverride = y - 48f)
    if (place.description.isNotBlank()) {
      drawWrappedText("설명 ${plainMarkdown(place.description)}", 100f, 420f, 8f, 11f, color = Colors.Muted, maxLines = 2, yOverride = y - 61f)
    }
    y -= 88f
  }

  private fun drawPlaceCard(place: RestaurantResponse, category: CategoryResponse, x: Float, top: Float) {
    drawCard(x, top - 166f, 248f, 166f, Colors.White)
    val imageBytes = photosByPlaceId[place.id]
    if (imageBytes != null) {
      drawImage(imageBytes, x + 12f, top - 76f, 58f, 58f)
    } else {
      drawFilledRect(x + 12f, top - 76f, 58f, 58f, Colors.Sand)
      drawText(category.label.take(2), x + 26f, top - 45f, 10f, fonts.bold, Colors.Muted)
    }
    drawText(category.label, x + 82f, top - 22f, 8f, fonts.bold, Colors.Rose)
    drawWrappedText(place.name, x + 82f, 140f, 11f, 14f, fonts.bold, Colors.Ink, maxLines = 2, yOverride = top - 38f)
    var textY = drawWrappedText(place.menu, x + 12f, 218f, 9f, 12f, fonts.bold, Colors.Muted, maxLines = 2, yOverride = top - 88f)
    if (place.description.isNotBlank()) {
      textY = drawWrappedText("설명 ${plainMarkdown(place.description)}", x + 12f, 218f, 8f, 11f, color = Colors.Muted, maxLines = 3, yOverride = textY - 2f)
    }
    textY = drawWrappedText("${place.distanceLabel} · ${travelModeLabel(place.travelMode)} ${place.travelMinutes}분", x + 12f, 218f, 8f, 11f, color = Colors.LightText, maxLines = 1, yOverride = textY - 2f)
    textY = drawWrappedText(place.address, x + 12f, 218f, 8f, 11f, color = Colors.LightText, maxLines = 2, yOverride = textY - 2f)
    if (!place.googleMapsNote.isNullOrBlank()) {
      drawWrappedText("메모 ${plainMarkdown(place.googleMapsNote)}", x + 12f, 218f, 8f, 11f, color = Colors.Muted, maxLines = 2, yOverride = textY - 2f)
    }
  }

  private fun drawMiniList(title: String, items: List<String>, x: Float, bottom: Float, width: Float, height: Float) {
    drawCard(x, bottom, width, height, Colors.White)
    drawText(title, x + 12f, bottom + height - 20f, 10f, fonts.bold, Colors.Ink)
    var itemY = bottom + height - 38f
    if (items.isEmpty()) {
      drawText("항목 없음", x + 12f, itemY, 8f, fonts.regular, Colors.LightText)
      return
    }
    items.take(4).forEach { item ->
      drawWrappedText("• $item", x + 12f, width - 24f, 8f, 11f, color = Colors.Muted, maxLines = 1, yOverride = itemY)
      itemY -= 13f
    }
  }

  private fun startSection(section: String, title: String, subtitle: String) {
    startPage(Colors.White)
    drawText("SECTION $section", 42f, 772f, 9f, fonts.bold, Colors.White, background = Colors.Ink)
    drawText("TravelNode Booklet", 425f, 772f, 8f, fonts.bold, Colors.LightText)
    drawText(title, 42f, 718f, 24f, fonts.bold, Colors.Ink)
    drawWrappedText(subtitle, 42f, 410f, 9f, 13f, color = Colors.Muted, maxLines = 2, yOverride = 695f)
    drawText(section, 500f, 708f, 42f, fonts.bold, Colors.Sand)
    y = 660f
  }

  private fun drawEmpty(text: String) {
    drawCard(42f, y - 86f, 511f, 86f, Colors.Soft)
    drawText(text, 215f, y - 46f, 11f, fonts.bold, Colors.Muted)
    y -= 108f
    drawPageFooter("Empty")
  }

  private fun startPage(background: Color) {
    closePage()
    pageImage = BufferedImage((pageWidth * renderScale).toInt(), (pageHeight * renderScale).toInt(), BufferedImage.TYPE_INT_RGB)
    graphics = pageImage?.createGraphics()?.apply {
      setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
      setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON)
      setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY)
    }
    pageNumber += 1
    y = 780f
    drawFilledRect(0f, 0f, pageWidth, pageHeight, background)
  }

  private fun closePage() {
    val image = pageImage ?: return
    graphics?.dispose()
    val pngBytes = ByteArrayOutputStream().use { output ->
      ImageIO.write(image, "png", output)
      output.toByteArray()
    }
    val page = PDPage(PDRectangle.A4)
    document.addPage(page)
    val pdfImage = PDImageXObject.createFromByteArray(document, pngBytes, "booklet-page-$pageNumber")
    PDPageContentStream(document, page).use { stream ->
      stream.drawImage(pdfImage, 0f, 0f, pageWidth, pageHeight)
    }
    pageImage = null
    graphics = null
  }

  private fun ensureSpace(required: Float) {
    if (y - required >= 62f) return
    startPage(Colors.White)
    drawBrand()
    y = 734f
  }

  private fun drawBrand() {
    drawText("TravelNode Guide", 42f, 800f, 8f, fonts.bold, Colors.Rose)
    drawText("PAGE ${pageNumber.toString().padStart(2, '0')}", 505f, 800f, 8f, fonts.bold, Colors.LightText)
  }

  private fun drawPageFooter(label: String) {
    drawLine(42f, 44f, 553f, 44f, Colors.Border)
    drawText(label, 42f, 28f, 7f, fonts.bold, Colors.LightText)
    drawText("Japan Trip Guide", 460f, 28f, 7f, fonts.bold, Colors.LightText)
  }

  private fun drawCard(x: Float, y: Float, width: Float, height: Float, fill: Color) {
    drawFilledRect(x, y, width, height, fill)
    drawStrokedRect(x, y, width, height, Colors.Border)
  }

  private fun drawFilledRect(x: Float, y: Float, width: Float, height: Float, color: Color) {
    val g = graphics ?: return
    g.color = color
    g.fill(Rectangle2D.Float(px(x), py(y, height), px(width), px(height)))
  }

  private fun drawStrokedRect(x: Float, y: Float, width: Float, height: Float, color: Color) {
    val g = graphics ?: return
    g.color = color
    g.stroke = BasicStroke(0.7f * renderScale)
    g.draw(Rectangle2D.Float(px(x), py(y, height), px(width), px(height)))
  }

  private fun drawLine(x1: Float, y1: Float, x2: Float, y2: Float, color: Color) {
    val g = graphics ?: return
    g.color = color
    g.stroke = BasicStroke(0.6f * renderScale)
    g.draw(Line2D.Float(px(x1), pyBaseline(y1), px(x2), pyBaseline(y2)))
  }

  private fun drawImage(bytes: ByteArray, x: Float, y: Float, width: Float, height: Float) {
    val g = graphics ?: return
    val image = runCatching { ImageIO.read(ByteArrayInputStream(bytes)) }.getOrNull() ?: return
    val scale = min(width / image.width, height / image.height)
    val drawWidth = image.width * scale
    val drawHeight = image.height * scale
    val drawX = x + (width - drawWidth) / 2f
    val drawY = y + (height - drawHeight) / 2f
    drawFilledRect(x, y, width, height, Colors.Sand)
    g.drawImage(
      image,
      px(drawX).toInt(),
      py(drawY, drawHeight).toInt(),
      px(drawWidth).toInt(),
      px(drawHeight).toInt(),
      null
    )
  }

  private fun drawText(
    text: String,
    x: Float,
    y: Float,
    size: Float,
    font: Font = fonts.regular,
    color: Color = Colors.Ink,
    background: Color? = null
  ) {
    val g = graphics ?: return
    val value = sanitize(text)
    if (value.isBlank()) return

    if (background != null) {
      val width = textWidth(value, font, size) + 14f
      drawFilledRect(x - 6f, y - 5f, width, size + 8f, background)
    }

    g.color = color
    g.font = font.deriveFont(size * renderScale)
    g.drawString(value, px(x), pyBaseline(y))
  }

  private fun drawWrappedText(
    text: String,
    x: Float,
    width: Float,
    size: Float,
    lineHeight: Float,
    font: Font = fonts.regular,
    color: Color = Colors.Ink,
    maxLines: Int = Int.MAX_VALUE,
    yOverride: Float? = null
  ): Float {
    val lines = wrapText(plainMarkdown(text), font, size, width).take(maxLines)
    var currentY = yOverride ?: y
    lines.forEach { line ->
      drawText(line, x, currentY, size, font, color)
      currentY -= lineHeight
    }
    if (yOverride == null) y = currentY
    return currentY
  }

  private fun wrapText(text: String, font: Font, size: Float, maxWidth: Float): List<String> {
    val normalized = sanitize(text).replace("\r\n", "\n").replace("\r", "\n")
    return normalized.split("\n").flatMap { paragraph ->
      if (paragraph.isBlank()) return@flatMap listOf("")
      val lines = mutableListOf<String>()
      var current = ""
      paragraph.codePoints().forEach { codePoint ->
        val char = String(Character.toChars(codePoint))
        val candidate = current + char
        if (current.isNotEmpty() && textWidth(candidate, font, size) > maxWidth) {
          lines += current.trimEnd()
          current = char.trimStart()
        } else {
          current = candidate
        }
      }
      if (current.isNotBlank()) lines += current.trimEnd()
      lines
    }
  }

  private fun textWidth(text: String, font: Font, size: Float): Float {
    val value = sanitize(text)
    val g = graphics ?: return value.length * size * 0.58f
    val metrics = g.getFontMetrics(font.deriveFont(size * renderScale))
    return metrics.stringWidth(value) / renderScale
  }

  private fun px(value: Float) = value * renderScale

  private fun py(y: Float, height: Float) = (pageHeight - y - height) * renderScale

  private fun pyBaseline(y: Float) = (pageHeight - y) * renderScale

  private fun sanitize(text: String): String {
    return text
      .replace("\t", " ")
      .replace(Regex("[\\uD800-\\uDFFF]"), "")
      .replace(Regex("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]"), "")
  }

  private fun plainMarkdown(value: String?): String {
    if (value.isNullOrBlank()) return ""
    return value
      .lines()
      .mapNotNull { rawLine ->
        val line = rawLine.trim()
        when {
          line.isBlank() -> ""
          line.startsWith("```") -> null
          Regex("^\\|?\\s*:?-{2,}:?\\s*(\\|\\s*:?-{2,}:?\\s*)+\\|?$").matches(line) -> null
          line.contains("|") -> line.trim('|').split("|").joinToString(" / ") { it.trim() }
          else -> line
            .replace(Regex("^#{1,6}\\s*"), "")
            .replace(Regex("^>\\s*"), "")
            .replace(Regex("^[-*]\\s+"), "• ")
            .replace(Regex("^\\d+\\.\\s+"), "• ")
            .replace(Regex("[*_`~]"), "")
        }
      }
      .joinToString("\n")
      .trim()
  }

  private fun hotelFor(day: ScheduleDayResponse): RestaurantResponse {
    return day.hotelPlaceId?.let(placesById::get) ?: defaultHotelPlace()
  }

  private fun defaultHotelPlace() = RestaurantResponse(
    id = "hotel",
    name = "Ginza Capital Hotel Moegi",
    category = "sightseeing",
    cuisine = "숙소",
    menu = "숙소",
    description = "여행 시작과 종료 기준이 되는 숙소입니다.",
    googleMapsNote = null,
    address = "Ginza Capital Hotel Moegi",
    googleMapsUrl = "",
    latitude = 35.668862,
    longitude = 139.773098,
    travelMode = "walk",
    travelMinutes = 0,
    distanceLabel = "0m",
    createdAt = OffsetDateTime.now(),
    updatedAt = OffsetDateTime.now()
  )

  private fun formatGeneratedAt(value: LocalDateTime) =
    value.format(DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm"))

  private fun formatTravelDate(value: String?): String {
    if (value.isNullOrBlank()) return "날짜 미지정"
    return runCatching {
      LocalDate.parse(value).format(DateTimeFormatter.ofPattern("yyyy.MM.dd"))
    }.getOrDefault("날짜 미지정")
  }

  private fun formatDepartureTime(minutes: Int?): String {
    if (minutes == null || minutes < 0 || minutes >= 1440) return "현재 기준"
    val hour = minutes / 60
    val minute = minutes % 60
    val period = if (hour < 12) "오전" else "오후"
    val displayHour = (hour % 12).let { if (it == 0) 12 else it }
    return "$period $displayHour:${minute.toString().padStart(2, '0')}"
  }

  private fun formatDayLabel(dayIndex: Int?): String =
    if (dayIndex == null) "DAY 미지정" else "DAY ${dayIndex + 1}"

  private fun routeModeLabel(mode: String) = when (mode) {
    "driving" -> "자동차"
    "transit" -> "대중교통"
    "walking" -> "도보"
    else -> mode
  }

  private fun travelModeLabel(mode: String) = when (mode) {
    "walk" -> "도보"
    "transit" -> "대중교통"
    else -> mode
  }

  private fun reservationTypeLabel(type: String) = when (type) {
    "restaurant" -> "식당 예약"
    "ticket" -> "티켓/입장권"
    "transport" -> "교통"
    "hotel" -> "숙소"
    else -> "기타"
  }

  private fun todoLabel(item: TodoItemResponse) = "${if (item.done) "완료" else "예정"} ${item.text}"

  private fun countTodos(todos: TodoListResponse) =
    todos.before.size + todos.after.size + todos.days.sumOf { it.items.size } + todos.custom.sumOf { it.items.size }

  private fun countDoneTodos(todos: TodoListResponse) =
    todos.before.count { it.done } +
      todos.after.count { it.done } +
      todos.days.sumOf { day -> day.items.count { it.done } } +
      todos.custom.sumOf { checklist -> checklist.items.count { it.done } }

  private object Colors {
    val Cream = Color(244, 239, 232)
    val Soft = Color(255, 250, 246)
    val White = Color(255, 255, 255)
    val Sand = Color(234, 223, 210)
    val Ink = Color(43, 33, 31)
    val Rose = Color(255, 56, 92)
    val Muted = Color(99, 88, 84)
    val LightText = Color(145, 132, 125)
    val WhiteMuted = Color(230, 224, 220)
    val Border = Color(225, 214, 203)
  }
}
