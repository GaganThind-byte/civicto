export type GeminiImage = {
  mimeType: string;
  data: string;
};

export type ComplaintModeration = {
  isNuisance: boolean;
  reason: string;
};

export type RepairPhotoReview = {
  approved: boolean;
  confidence: number;
  reason: string;
};

export class GeminiServiceError extends Error {
  constructor(message: string, readonly statusCode: number = 503) {
    super(message);
    this.name = 'GeminiServiceError';
  }
}

async function generateJson<T>(prompt: string, image?: GeminiImage): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiServiceError('AI review is not configured. Add GEMINI_API_KEY and try again.');
  }

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (image) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  }

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch {
    throw new GeminiServiceError('Could not reach the AI review service. Please try again.');
  }

  if (!response.ok) {
    throw new GeminiServiceError(`AI review failed with HTTP ${response.status}.`, 502);
  }

  const payload: unknown = await response.json();
  const text = getResponseText(payload);
  if (!text) {
    throw new GeminiServiceError('AI review returned no result. Please try again.', 502);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiServiceError('AI review returned an invalid result. Please try again.', 502);
  }
}

function getResponseText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  return candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() || undefined;
}

export async function moderateComplaint(input: {
  title: string;
  description: string;
  image?: GeminiImage;
}): Promise<ComplaintModeration> {
  const result = await generateJson<ComplaintModeration>(
    [
      'Decide whether this report is a genuine residential-community maintenance, safety, cleanliness, or shared-facility issue.',
      'Mark nuisance only for spam, advertising, abusive content, clearly irrelevant content, or a fabricated/non-issue.',
      'Do not reject a report merely because details are incomplete or the photo is unclear.',
      'Return JSON only with boolean isNuisance and a brief reason string.',
      `Title: ${input.title}`,
      `Description: ${input.description}`,
    ].join('\n'),
    input.image,
  );

  if (typeof result.isNuisance !== 'boolean' || typeof result.reason !== 'string') {
    throw new GeminiServiceError('AI moderation returned an invalid result. Please try again.', 502);
  }
  return result;
}

export async function reviewRepairPhoto(input: {
  title: string;
  description: string;
  image: GeminiImage;
}): Promise<RepairPhotoReview> {
  const result = await generateJson<RepairPhotoReview>(
    [
      'Review the attached after-repair photo for this community maintenance complaint.',
      'Approve only when the photo provides clear, relevant evidence that the reported issue has been repaired.',
      'If uncertain, unrelated, or the issue cannot be judged from the photo, set approved to false.',
      'Return JSON only with boolean approved, numeric confidence from 0 to 1, and a brief reason string.',
      `Title: ${input.title}`,
      `Reported issue: ${input.description}`,
    ].join('\n'),
    input.image,
  );

  if (
    typeof result.approved !== 'boolean'
    || typeof result.confidence !== 'number'
    || !Number.isFinite(result.confidence)
    || typeof result.reason !== 'string'
  ) {
    throw new GeminiServiceError('AI photo review returned an invalid result. Please try again.', 502);
  }

  return {
    approved: result.approved && result.confidence >= 0.75,
    confidence: Math.min(1, Math.max(0, result.confidence)),
    reason: result.reason,
  };
}
