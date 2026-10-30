export type TriageCategory =
  | 'plumbing'
  | 'electrical'
  | 'housekeeping'
  | 'lift-elevator'
  | 'security'
  | 'civil-masonry'
  | 'hvac';

export type TriageUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TriageResult = {
  category: TriageCategory;
  sub_category: string;
  urgency: TriageUrgency;
  confidence: number;
  is_nuisance_or_spam: boolean;
  justification: string;
};

type CategoryRule = {
  category: TriageCategory;
  sub_category: string;
  keywords: string[];
  urgency: TriageUrgency;
};

const categoryRules: CategoryRule[] = [
  {
    category: 'electrical',
    sub_category: 'power_or_wiring_issue',
    keywords: ['spark', 'sparking', 'shock', 'socket', 'switchboard', 'fuse', 'circuit', 'power cut', 'power outage', 'flickering', 'short circuit', 'electricity'],
    urgency: 'CRITICAL',
  },
  {
    category: 'plumbing',
    sub_category: 'water_leak_or_blockage',
    keywords: ['leak', 'water', 'pipe', 'drip', 'dripping', 'toilet overflow', 'clog', 'blocked drain', 'sewer', 'plumbing'],
    urgency: 'HIGH',
  },
  {
    category: 'lift-elevator',
    sub_category: 'lift_operation_issue',
    keywords: ['lift', 'elevator', 'stuck between floors', 'lift stuck', 'door jam', 'not moving', 'hoist'],
    urgency: 'CRITICAL',
  },
  {
    category: 'security',
    sub_category: 'entry_or_safety_issue',
    keywords: ['gate', 'security', 'unauthorized', 'theft', 'break in', 'intruder', 'lock', 'camera', 'entry', 'door not locking'],
    urgency: 'HIGH',
  },
  {
    category: 'civil-masonry',
    sub_category: 'structural_or_wall_damage',
    keywords: ['ceiling crack', 'wall crack', 'tile', 'masonry', 'plaster', 'roof', 'structural', 'broken beam'],
    urgency: 'HIGH',
  },
  {
    category: 'hvac',
    sub_category: 'cooling_or_airflow_issue',
    keywords: ['ac', 'air conditioner', 'hvac', 'cooling', 'ventilation', 'heating', 'fan not working', 'temperature'],
    urgency: 'MEDIUM',
  },
  {
    category: 'housekeeping',
    sub_category: 'sanitation_or_cleanliness_issue',
    keywords: ['garbage', 'trash', 'cleaning', 'dirty', 'sanitation', 'pest', 'rodent', 'mosquito', 'mess', 'sweep'],
    urgency: 'LOW',
  },
];

const spamKeywords = ['spam', 'advertisement', 'marketing', 'sale', 'offer', 'promo'];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function triageComplaint(
  imageUrl: string,
  description: string,
): Promise<TriageResult> {
  const text = normalizeText(`${imageUrl ?? ''} ${description ?? ''}`);

  if (!text) {
    return {
      category: 'housekeeping',
      sub_category: 'general_cleanup',
      urgency: 'LOW',
      confidence: 0.6,
      is_nuisance_or_spam: false,
      justification: 'Fallback classification used because minimal information was provided.',
    };
  }

  const isNuisance = spamKeywords.some((keyword) => text.includes(keyword));

  let bestMatch: CategoryRule | undefined;
  let bestScore = 0;

  for (const rule of categoryRules) {
    const score = rule.keywords.reduce((total, keyword) => {
      return total + (text.includes(keyword) ? 2 : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  if (!bestMatch || bestScore === 0) {
    return {
      category: 'housekeeping',
      sub_category: 'general_cleanup',
      urgency: 'MEDIUM',
      confidence: 0.58,
      is_nuisance_or_spam: isNuisance,
      justification: 'The issue description was too general to confidently route it, so it was placed in the general queue.',
    };
  }

  const urgency: TriageUrgency =
    bestMatch.urgency === 'CRITICAL' || text.includes('fire') || text.includes('smoke')
      ? 'CRITICAL'
      : bestMatch.urgency === 'HIGH' || text.includes('urgent')
        ? 'HIGH'
        : bestMatch.urgency === 'MEDIUM' || text.includes('intermittent')
          ? 'MEDIUM'
          : 'LOW';

  const confidence = Math.min(0.96, 0.62 + bestScore * 0.12 + (isNuisance ? -0.1 : 0.05));

  return {
    category: bestMatch.category,
    sub_category: bestMatch.sub_category,
    urgency,
    confidence: Number(confidence.toFixed(2)),
    is_nuisance_or_spam: isNuisance,
    justification: `Matched ${bestMatch.category.replace('-', ' ')}-related keywords and mapped the issue to the ${bestMatch.sub_category.replace(/_/g, ' ')} workflow.`,
  };
}
