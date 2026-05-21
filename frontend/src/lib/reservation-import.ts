import type { ReservationDraft, ReservationType } from '@/types/reservation';
import type { Place } from '@/types/travel';

export const defaultReservationPlatforms = ['구글예약', '트립닷컴', '마이리얼트립'];

const emptyReservationDraft: ReservationDraft = {
  reservationType: 'ticket',
  title: '',
  dayIndex: null,
  placeId: null,
  timeLabel: '',
  bookingPlatform: '',
  referenceNumber: '',
  linkUrl: '',
  notes: '',
  attachments: [],
  completed: false
};

export function parseGoogleReservationText(rawText: string, places: Place[], dayCount: number): ReservationDraft[] {
  return rawText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => parseGoogleReservationBlock(block, places, dayCount))
    .filter((draft): draft is ReservationDraft => Boolean(draft));
}

function parseGoogleReservationBlock(block: string, places: Place[], dayCount: number): ReservationDraft | null {
  const lines = block
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const googleMapsDraft = parseGoogleMapsReservationBlock(block, lines, places, dayCount);
  if (googleMapsDraft) return googleMapsDraft;

  const matchedPlace = findMatchingPlace(block, places);
  const title = matchedPlace?.name ?? findTitleLine(lines);
  if (!title) return null;

  const dayIndex = parseDayIndex(block, dayCount);
  const timeLabel = parseTimeLabel(block);
  const referenceNumber = parseReferenceNumber(block);
  const linkUrl = parseFirstUrl(block);
  const reservationType = inferReservationType(block, matchedPlace);
  const notes = lines
    .filter((line) => !linkUrl || !line.includes(linkUrl))
    .slice(0, 8)
    .join('\n')
    .slice(0, 1000);

  return {
    ...emptyReservationDraft,
    reservationType,
    title,
    dayIndex,
    placeId: matchedPlace?.id ?? null,
    timeLabel,
    bookingPlatform: inferReservationPlatform(block),
    referenceNumber,
    linkUrl,
    notes,
    attachments: []
  };
}

function parseGoogleMapsReservationBlock(
  block: string,
  lines: string[],
  places: Place[],
  dayCount: number
): ReservationDraft | null {
  const detailIndex = lines.findIndex((line) => /^(예약\s*내역|reservation details)$/i.test(line));
  if (detailIndex < 0) return null;

  const dateLine = [...lines.slice(0, detailIndex)]
    .reverse()
    .find((line) => /(?:[0-9]{1,2}\s*월\s*)?[0-9]{1,2}\s*일|[0-9]{4}[./-]\s*[0-9]{1,2}[./-]\s*[0-9]{1,2}/.test(line)) ?? '';
  const detailLines = lines.slice(detailIndex + 1);
  const summaryLine = detailLines.find(isGoogleReservationSummaryLine) ?? '';
  const titleLine = detailLines.find((line) => isLikelyGoogleReservationTitle(line, summaryLine)) ?? '';

  if (!titleLine) return null;

  const matchedPlace = findMatchingPlace([titleLine, block].join('\n'), places);
  const addressLine = findGoogleReservationAddressLine(detailLines);
  const categoryLine = findGoogleReservationCategoryLine(detailLines, titleLine, summaryLine, addressLine);
  const partyLabel = summaryLine.match(/(?:^|·)\s*([0-9]+\s*명)\s*(?:$|·)/)?.[1] ?? '';
  const notes = [
    categoryLine ? `유형: ${categoryLine}` : '',
    partyLabel ? `인원: ${partyLabel}` : '',
    addressLine ? `주소: ${addressLine}` : ''
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1000);

  return {
    ...emptyReservationDraft,
    reservationType: inferReservationType([titleLine, categoryLine, block].filter(Boolean).join('\n'), matchedPlace),
    title: (matchedPlace?.name ?? titleLine).slice(0, 120),
    dayIndex: parseDayIndex(block, dayCount),
    placeId: matchedPlace?.id ?? null,
    timeLabel: formatGoogleReservationTimeLabel(dateLine, summaryLine),
    bookingPlatform: '구글예약',
    referenceNumber: parseReferenceNumber(block),
    linkUrl: parseFirstUrl(block),
    notes,
    attachments: []
  };
}

function isGoogleReservationSummaryLine(line: string) {
  return /(?:오전|오후|AM|PM|[0-2]?[0-9]:[0-5][0-9])/i.test(line) && /(?:·|\s)/.test(line);
}

function isLikelyGoogleReservationTitle(line: string, summaryLine: string) {
  if (!line || line === summaryLine) return false;
  if (/^(예약\s*내역|판매자\s*위치|merchant location|seller location)$/i.test(line)) return false;
  if (/^(?:[0-9]{1,2}\s*월\s*)?[0-9]{1,2}\s*일$/.test(line)) return false;
  if (/^[0-9]{1,2}\s*월$/.test(line)) return false;
  if (/^[0-9](?:\.[0-9])?\s*\([0-9,]+\)/.test(line)) return false;
  if (isGoogleReservationAddressLine(line)) return false;
  return true;
}

function findGoogleReservationAddressLine(lines: string[]) {
  const locationIndex = lines.findIndex((line) => /^(판매자\s*위치|merchant location|seller location)$/i.test(line));
  if (locationIndex > 0 && isGoogleReservationAddressLine(lines[locationIndex - 1])) {
    return lines[locationIndex - 1];
  }

  return lines.find(isGoogleReservationAddressLine) ?? '';
}

function isGoogleReservationAddressLine(line: string) {
  return /(?:일본|Japan|Tokyo|Osaka|Kyoto|〒|[0-9]+-chōme|[0-9]+-chome|City|Ward)/i.test(line);
}

function findGoogleReservationCategoryLine(lines: string[], titleLine: string, summaryLine: string, addressLine: string) {
  return lines.find((line) => {
    if (!line || line === titleLine || line === summaryLine || line === addressLine) return false;
    if (/^(예약\s*내역|판매자\s*위치|merchant location|seller location)$/i.test(line)) return false;
    if (/^[0-9](?:\.[0-9])?\s*\([0-9,]+\)/.test(line)) return false;
    if (isGoogleReservationAddressLine(line)) return false;
    return /(?:전문점|음식점|레스토랑|카페|bar|restaurant|cafe|shop|store|museum|hotel)/i.test(line);
  }) ?? '';
}

function formatGoogleReservationTimeLabel(dateLine: string, summaryLine: string) {
  return [dateLine, summaryLine].filter(Boolean).join(' · ').replace(/\s+/g, ' ').slice(0, 80);
}

type GoogleBookingCsvRow = Record<string, string>;

export function parseGoogleBookingsCsv(csvText: string, places: Place[], dayCount: number): ReservationDraft[] {
  return parseGoogleBookingsCsvRows(csvText)
    .map((row) => googleBookingRowToDraft(row, places, dayCount))
    .filter((draft): draft is ReservationDraft => Boolean(draft));
}

export function parseGoogleBookingsCsvRows(csvText: string): GoogleBookingCsvRow[] {
  const rows = parseCsvRows(csvText.replace(/^\uFEFF/, ''));
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? '']))
  );
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function googleBookingRowToDraft(row: GoogleBookingCsvRow, places: Place[], dayCount: number): ReservationDraft | null {
  const bookingName = row['Booking Name'] ?? '';
  const merchantName = row['Merchant Name'] ?? '';
  const startTime = row['Start Time'] ?? '';
  const endTime = row['End Time'] ?? '';
  const price = row.Price ?? '';
  const address = row.Address ?? '';
  const canceled = row.Canceled ?? '';
  const specialRequest = row['Special Request'] ?? '';
  const title = (bookingName || merchantName).trim().slice(0, 120);

  if (!title) return null;

  const searchableText = [bookingName, merchantName, address].filter(Boolean).join('\n');
  const matchedPlace = findMatchingPlace(searchableText, places);
  const notes = [
    merchantName && merchantName !== title ? `상점명: ${merchantName}` : '',
    price ? `가격: ${price}` : '',
    address ? `주소: ${address}` : '',
    canceled ? `취소 여부: ${canceled}` : '',
    specialRequest ? `요청사항: ${specialRequest}` : ''
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1000);
  const timeLabel = [startTime, endTime].filter(Boolean).join(' ~ ').slice(0, 80);

  return {
    ...emptyReservationDraft,
    reservationType: inferReservationType(searchableText, matchedPlace),
    title,
    dayIndex: parseDayIndex(startTime, dayCount),
    placeId: matchedPlace?.id ?? null,
    timeLabel,
    bookingPlatform: '구글예약',
    referenceNumber: '',
    linkUrl: '',
    notes,
    attachments: []
  };
}

function findMatchingPlace(text: string, places: Place[]) {
  const normalizedText = normalizeSearchText(text);
  return places.find((place) => {
    const normalizedName = normalizeSearchText(place.name);
    return normalizedName.length >= 3 && normalizedText.includes(normalizedName);
  }) ?? null;
}

function findTitleLine(lines: string[]) {
  return lines
    .find((line) => !/^https?:\/\//i.test(line) && !/^(예약번호|booking|confirmation|date|time|날짜|시간|주소|address)\s*[:：]/i.test(line))
    ?.slice(0, 120)
    .trim() ?? '';
}

function parseDayIndex(text: string, dayCount: number) {
  const dayMatch = text.match(/\bday\s*([0-9]{1,2})\b/i) ?? text.match(/DAY\s*([0-9]{1,2})/i);
  if (!dayMatch) return null;
  const dayIndex = Number(dayMatch[1]) - 1;
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= dayCount) return null;
  return dayIndex;
}

function parseTimeLabel(text: string) {
  const dateTimeMatch = text.match(/([0-9]{4}[./-]\s*[0-9]{1,2}[./-]\s*[0-9]{1,2}[^0-9]{1,8}[0-9]{1,2}:[0-9]{2})/);
  if (dateTimeMatch) return dateTimeMatch[1].replace(/\s+/g, ' ').slice(0, 80);

  const koreanDateTimeMatch = text.match(/([0-9]{1,2}\s*월\s*[0-9]{1,2}\s*일[^0-9]{1,8}[0-9]{1,2}:[0-9]{2})/);
  if (koreanDateTimeMatch) return koreanDateTimeMatch[1].replace(/\s+/g, ' ').slice(0, 80);

  const timeMatch = text.match(/\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b/);
  return timeMatch?.[0] ?? '';
}

function parseReferenceNumber(text: string) {
  const referenceMatch =
    text.match(/(?:예약번호|예약 번호|confirmation|booking|reference|order)\s*[:：#]?\s*([A-Z0-9-]{4,})/i) ??
    text.match(/\b[A-Z]{2,}[0-9][A-Z0-9-]{3,}\b/);
  return referenceMatch?.[1]?.slice(0, 120) ?? referenceMatch?.[0]?.slice(0, 120) ?? '';
}

function parseFirstUrl(text: string) {
  return text.match(/https?:\/\/[^\s)]+/i)?.[0]?.slice(0, 500) ?? '';
}

function inferReservationType(text: string, place: Place | null): ReservationType {
  const normalizedText = normalizeSearchText(text);
  if (place?.category === 'meal' || place?.category === 'dessert') return 'restaurant';
  if (normalizedText.includes('hotel') || normalizedText.includes('숙소') || normalizedText.includes('checkin')) return 'hotel';
  if (normalizedText.includes('train') || normalizedText.includes('flight') || normalizedText.includes('교통') || normalizedText.includes('항공')) return 'transport';
  if (normalizedText.includes('ticket') || normalizedText.includes('티켓') || normalizedText.includes('입장권')) return 'ticket';
  return 'restaurant';
}

function inferReservationPlatform(text: string) {
  const normalizedText = normalizeSearchText(text);
  const matchedPlatform = defaultReservationPlatforms.find((platform) => normalizedText.includes(normalizeSearchText(platform)));
  return matchedPlatform ?? '';
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}
