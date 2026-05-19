type DataResponse<T> = {
  data: T;
};

type ErrorResponse = {
  errors?: string[];
};

async function readJson<T>(response: Response, fallbackMessage: string) {
  const text = await response.text();
  if (!text.trim()) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(httpFallbackMessage(response, fallbackMessage, text));
  }
}

export async function readData<T>(response: Response, fallbackMessage: string) {
  const payload = await readJson<Partial<DataResponse<T>> & ErrorResponse>(response, fallbackMessage);

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.errors?.join(', ') ?? fallbackMessage);
  }

  return payload.data;
}

export async function readError(response: Response, fallbackMessage: string) {
  try {
    const payload = await readJson<ErrorResponse>(response, fallbackMessage);
    return payload.errors?.join(', ') ?? fallbackMessage;
  } catch (error) {
    return error instanceof Error ? error.message : fallbackMessage;
  }
}

function httpFallbackMessage(response: Response, fallbackMessage: string, body: string) {
  if (response.status === 413) {
    return '요청 용량이 너무 큽니다. PDF/이미지 첨부파일 개수나 용량을 줄인 뒤 다시 저장해주세요.';
  }

  const compactBody = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const statusLabel = response.status ? `HTTP ${response.status}` : '서버 응답';
  const detail = compactBody.slice(0, 120);
  return detail ? `${fallbackMessage} (${statusLabel}: ${detail})` : `${fallbackMessage} (${statusLabel})`;
}
