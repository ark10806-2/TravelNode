import { authHeaders } from '@/api/auth';
import { apiBaseUrl } from '@/config/env';
import { downloadBlob } from '@/lib/downloads';

export async function downloadTripBookletPdf() {
  const response = await fetch(`${apiBaseUrl}/api/booklet/pdf`, {
    headers: authHeaders()
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  const blob = await response.blob();
  const fileName = filenameFromDisposition(response.headers.get('Content-Disposition')) ?? 'travel-node-booklet.pdf';
  downloadBlob(blob, fileName);
}

async function errorMessage(response: Response) {
  const fallback = 'PDF를 생성하지 못했습니다.';

  try {
    const payload = await response.json();
    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      return payload.errors.join('\n');
    }
  } catch {
    // The PDF endpoint may return a non-JSON error if the proxy fails.
  }

  return fallback;
}

function filenameFromDisposition(value: string | null) {
  if (!value) return null;
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);

  const quotedMatch = value.match(/filename="([^"]+)"/i);
  if (quotedMatch) return quotedMatch[1];

  const plainMatch = value.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim() ?? null;
}
