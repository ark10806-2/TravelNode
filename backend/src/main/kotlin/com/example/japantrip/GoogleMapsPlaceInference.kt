package com.example.japantrip

import kotlin.math.ceil

object GoogleMapsPlaceInference {
  fun category(name: String, note: String): String {
    val text = "$name $note".lowercase()
    return when {
      DessertKeywords.any { it in text } -> "dessert"
      SightseeingKeywords.any { it in text } -> "sightseeing"
      else -> "meal"
    }
  }

  fun cuisine(name: String, category: String): String {
    val text = name.lowercase()
    return when {
      category == "dessert" -> "디저트 / 카페"
      category == "sightseeing" -> "관광 / 쇼핑"
      "우동" in text || "うどん" in text -> "우동"
      "라멘" in text || "ramen" in text -> "라멘"
      "돈카츠" in text || "とんかつ" in text || "카츠" in text -> "돈카츠"
      "야키니쿠" in text || "焼肉" in text || "chikamitsu" in text -> "야키니쿠"
      "샤부" in text || "しゃぶ" in text -> "샤부샤부"
      "호르몬" in text || "horumon" in text -> "호르몬야키"
      "몬자" in text -> "몬자야키"
      "맥주" in text || "bar" in text -> "바 / 맥주"
      else -> "음식점"
    }
  }

  fun menu(name: String, note: String, category: String): String {
    if (note.isNotBlank()) return note

    val text = name.lowercase()
    return when {
      category == "dessert" -> "대표 디저트 / 음료"
      category == "sightseeing" -> "방문 후보"
      "우동" in text || "うどん" in text -> "우동"
      "라멘" in text || "ramen" in text -> "라멘"
      "돈카츠" in text || "とんかつ" in text || "카츠" in text -> "돈카츠"
      "야키니쿠" in text || "焼肉" in text || "chikamitsu" in text -> "야키니쿠"
      "샤부" in text || "しゃぶ" in text -> "샤부샤부"
      "호르몬" in text || "horumon" in text -> "호르몬야키"
      "몬자" in text -> "몬자야키"
      "맥주" in text || "bar" in text -> "맥주 / 음료"
      else -> "대표 메뉴 확인 필요"
    }
  }

  fun description(name: String, note: String, listTitle: String?): String {
    val prefix = listTitle?.takeIf { it.isNotBlank() }?.let { "$it 목록" } ?: "Google Maps 즐겨찾기"
    return "${name}은 ${prefix}에서 가져온 장소입니다. 방문 전 영업시간과 휴무일을 확인해주세요."
  }

  fun estimateTravelMinutes(distanceKm: Double, travelMode: String): Int {
    return if (travelMode == "walk") {
      ceil(distanceKm / 0.08).toInt().coerceAtLeast(1)
    } else {
      ceil(distanceKm * 3 + 12).toInt().coerceIn(15, 60)
    }
  }

  private val DessertKeywords = listOf(
    "cafe",
    "카페",
    "커피",
    "coffee",
    "초콜릿",
    "chocolate",
    "하브스",
    "harbs",
    "크레페",
    "クレープ",
    "espresso",
    "에스프레ッソ",
    "パン",
    "팡 ",
    "bakery",
    "bread",
    "cha "
  )

  private val SightseeingKeywords = listOf(
    "museum",
    "뮤지엄",
    "미술관",
    "박물관",
    "aquarium",
    "아쿠아리움",
    "디즈니",
    "disney",
    "루미네",
    "lumine",
    "bshop",
    "도버 스트리트",
    "market",
    "쇼핑",
    "호텔"
  )

}
