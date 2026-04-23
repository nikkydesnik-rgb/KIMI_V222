import { arrayBufferToBase64, base64ToArrayBuffer } from './docxParser';

type RenderServerResponse = {
  success: boolean;
  docxBase64?: string;
  error?: string;
};

const DEFAULT_RENDER_URL = '/api/render-docx';

/**
 * Try server-side DOCX rendering (Python/docxtpl).
 * Returns null if server is unavailable or response is invalid.
 */
export async function tryRenderDocxOnServer(
  templateBuffer: ArrayBuffer,
  data: Record<string, string>
): Promise<ArrayBuffer | null> {
  const endpoint = import.meta.env.VITE_RENDER_API_URL || DEFAULT_RENDER_URL;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateBase64: arrayBufferToBase64(templateBuffer),
        data,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as RenderServerResponse;
    if (!payload.success || !payload.docxBase64) {
      return null;
    }

    return base64ToArrayBuffer(payload.docxBase64);
  } catch {
    return null;
  }
}
