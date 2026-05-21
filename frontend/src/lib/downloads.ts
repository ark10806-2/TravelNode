const retainedDownloadUrls = new Set<string>();

export function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = window.URL.createObjectURL(blob);
  // iOS Safari may re-read blob URLs when returning with Back, so keep them alive for this page session.
  retainedDownloadUrls.add(objectUrl);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName || 'download';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
