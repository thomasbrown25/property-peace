import { MaintenanceCategory } from '../api/maintenanceAPI';

export interface MaintenanceMetadata {
  title: string;
  priority: 'low' | 'medium' | 'high';
  categoryId: number;
}

/**
 * Generates maintenance request metadata (title, priority, category) from description
 * Uses keyword-based analysis (can be enhanced with Azure AI services later)
 */
export async function generateMaintenanceMetadata(
  description: string,
  categories: MaintenanceCategory[]
): Promise<MaintenanceMetadata> {
  if (!description || description.trim().length === 0) {
    throw new Error('Description is required');
  }

  if (!categories || categories.length === 0) {
    throw new Error('Categories are required');
  }

  const textToAnalyze = description.toLowerCase().trim();

  // Generate title from description
  const title = generateTitle(description);

  // Determine priority
  const priority = determinePriority(textToAnalyze);

  // Determine category
  const categoryId = determineCategory(textToAnalyze, categories);

  return {
    title,
    priority,
    categoryId,
  };
}

/**
 * Generates a concise title from the description
 */
function generateTitle(description: string): string {
  // Remove extra whitespace
  const cleaned = description.trim().replace(/\s+/g, ' ');

  // If description is short enough, use it as-is (max 60 chars)
  if (cleaned.length <= 60) {
    // Capitalize first letter
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Extract first sentence or first 60 characters
  const firstSentence = cleaned.split(/[.!?]/)[0];
  if (firstSentence.length <= 60) {
    return firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);
  }

  // Take first 60 characters and add ellipsis
  const truncated = cleaned.substring(0, 57).trim();
  return truncated.charAt(0).toUpperCase() + truncated.slice(1) + '...';
}

/**
 * Determines priority based on keywords in the description
 */
function determinePriority(text: string): 'low' | 'medium' | 'high' {
  // High priority keywords
  const highPriorityKeywords = [
    'leak',
    'leaking',
    'flood',
    'flooding',
    'fire',
    'smoke',
    'smoking',
    'broken',
    'emergency',
    'urgent',
    'no heat',
    'no water',
    'no power',
    'electrical',
    'gas',
    'danger',
    'dangerous',
    'safety',
    'burst',
    'overflow',
    'sparking',
    'sparks',
    'water damage',
    'flooded',
    'not working',
    "doesn't work",
    'stopped working',
    'fell off',
    'broken down',
    'critical',
  ];

  // Low priority keywords
  const lowPriorityKeywords = [
    'cosmetic',
    'minor',
    'touch up',
    'clean',
    'cleaning',
    'paint',
    'painting',
    'aesthetic',
    'routine',
    'maintenance',
    'preventive',
    'preventative',
    'upgrade',
    'improvement',
    'enhancement',
    'optional',
    'nice to have',
  ];

  // Check for high priority keywords
  const hasHighPriorityKeyword = highPriorityKeywords.some((keyword) =>
    text.includes(keyword)
  );

  // Check for low priority keywords
  const hasLowPriorityKeyword = lowPriorityKeywords.some((keyword) =>
    text.includes(keyword)
  );

  // Determine priority
  if (hasHighPriorityKeyword) {
    return 'high';
  } else if (hasLowPriorityKeyword) {
    return 'low';
  } else {
    // Default to medium
    return 'medium';
  }
}

/**
 * Determines category based on keywords in the description
 */
function determineCategory(
  text: string,
  categories: MaintenanceCategory[]
): number {
  // Category keyword mappings
  const categoryKeywords: Record<string, string[]> = {
    plumbing: [
      'plumb',
      'pipe',
      'drain',
      'faucet',
      'sink',
      'toilet',
      'shower',
      'bathtub',
      'water',
      'leak',
      'leaking',
      'dripping',
      'clog',
      'clogged',
      'backup',
      'overflow',
      'hot water',
      'cold water',
      'sprinkler',
      'pump',
    ],
    electrical: [
      'electrical',
      'electric',
      'outlet',
      'switch',
      'light',
      'lighting',
      'bulb',
      'breaker',
      'circuit',
      'power',
      'wiring',
      'fuse',
      'spark',
      'sparking',
      'shock',
      'voltage',
      'amp',
      'telephone',
      'phone line',
    ],
    appliances: [
      'appliance',
      'stove',
      'oven',
      'refrigerator',
      'fridge',
      'dishwasher',
      'washer',
      'dryer',
      'microwave',
      'heating',
      'cooling',
      'ac',
      'air conditioning',
      'hvac',
      'furnace',
      'boiler',
    ],
    household: [
      'door',
      'window',
      'lock',
      'key',
      'closet',
      'floor',
      'flooring',
      'carpet',
      'wall',
      'ceiling',
      'pest',
      'bug',
      'insect',
      'rodent',
      'mouse',
      'roach',
      'ant',
    ],
    exterior: [
      'roof',
      'roofing',
      'siding',
      'gutter',
      'chimney',
      'exterior',
      'outside',
      'outdoor',
    ],
    outdoors: [
      'landscaping',
      'landscape',
      'fence',
      'fencing',
      'pool',
      'porch',
      'deck',
      'parking',
      'driveway',
      'sidewalk',
      'yard',
      'lawn',
      'garden',
    ],
  };

  // Count matches for each category
  const categoryScores: Record<string, number> = {};

  for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        score += 1;
      }
    }
    if (score > 0) {
      categoryScores[categoryName] = score;
    }
  }

  // Find the category with the highest score
  let bestCategory = 'general_repair'; // Default
  let highestScore = 0;

  for (const [categoryName, score] of Object.entries(categoryScores)) {
    if (score > highestScore) {
      highestScore = score;
      bestCategory = categoryName;
    }
  }

  // Map category name to backend category value
  const categoryValueMap: Record<string, string> = {
    plumbing: 'plumbing',
    electrical: 'electrical',
    appliances: 'general_repair',
    household: 'general_repair',
    exterior: 'general_repair',
    outdoors: 'general_repair',
  };

  const targetValue = categoryValueMap[bestCategory] || 'general_repair';

  // Find matching category in the categories list
  const matchedCategory = categories.find(
    (cat) => cat.value?.toLowerCase() === targetValue.toLowerCase()
  );

  if (matchedCategory) {
    return matchedCategory.id;
  }

  // Fallback to first category if no match found
  return categories[0]?.id || 1;
}
