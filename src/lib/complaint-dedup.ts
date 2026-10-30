export type DuplicateCandidate = {
  title: string;
  description: string;
  category: string;
  location: string;
};

export type DuplicateMatch = {
  isDuplicate: boolean;
  similarity: number;
  existingId?: string;
  reason?: string;
};

type ComplaintsLike = Array<{
  id: string;
  title?: string;
  description?: string;
  category?: string;
  location?: string;
}>;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalize(value).split(' ').filter(Boolean));
}

export function findDuplicateComplaint(
  candidate: DuplicateCandidate,
  complaints: ComplaintsLike,
): DuplicateMatch {
  if (!complaints.length) {
    return { isDuplicate: false, similarity: 0 };
  }

  const candidateTokens = tokenSet(`${candidate.title} ${candidate.description}`);
  const candidateLocation = normalize(candidate.location);
  const candidateCategory = normalize(candidate.category);

  let bestMatch: { isDuplicate: boolean; similarity: number; existingId?: string; reason?: string } = {
    isDuplicate: false,
    similarity: 0,
  };

  for (const complaint of complaints) {
    const existingTitle = normalize(complaint.title ?? '');
    const existingDescription = normalize(complaint.description ?? '');
    const existingLocation = normalize(complaint.location ?? '');
    const existingCategory = normalize(complaint.category ?? '');

    const existingTokens = Array.from(tokenSet(`${existingTitle} ${existingDescription}`));
    const combinedTokens = new Set(Array.from(candidateTokens).concat(existingTokens));

    const sharedTokens = Array.from(candidateTokens).filter((token) =>
      existingTokens.includes(token),
    );

    const overlap = sharedTokens.length / Math.max(1, combinedTokens.size);
    const locationMatch = candidateLocation && existingLocation && candidateLocation === existingLocation ? 0.25 : 0;
    const categoryMatch = candidateCategory && existingCategory && candidateCategory === existingCategory ? 0.2 : 0;
    const similarity = Number((overlap + locationMatch + categoryMatch).toFixed(2));

    if (similarity >= 0.35) {
      const reason = locationMatch > 0 ? 'same location and issue pattern' : 'same issue pattern';
      bestMatch = {
        isDuplicate: true,
        similarity,
        existingId: complaint.id,
        reason,
      };
      break;
    }
  }

  return bestMatch;
}
