type DataResponse<T> = {
  data: T;
};

type ErrorResponse = {
  errors?: string[];
};

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

export async function readData<T>(response: Response, fallbackMessage: string) {
  const payload = await readJson<Partial<DataResponse<T>> & ErrorResponse>(response);

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.errors?.join(', ') ?? fallbackMessage);
  }

  return payload.data;
}

export async function readError(response: Response, fallbackMessage: string) {
  try {
    const payload = await readJson<ErrorResponse>(response);
    return payload.errors?.join(', ') ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}
