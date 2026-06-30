// Construction de prompts riches (couleurs + disposition) pour le rendu interieur.
// Le frontend envoie un payload JSON par outil (style, season, furniture[], material...).

// --- Palettes de couleurs par style (pilotent la coherence chromatique) ---
const STYLE_PALETTES = {
  scandinave: 'light oak wood, white and soft beige tones, muted pastel accents, airy and bright',
  industriel: 'exposed brick, dark steel, raw concrete, charcoal grey, warm leather brown accents',
  boheme:     'warm terracotta, mustard yellow, rattan and natural fibers, layered earthy tones, lush green plants',
  luxe:       'deep emerald and navy, gold and brass accents, marble surfaces, rich velvet textures',
  moderne:    'neutral greys and whites, clean matte black accents, minimal warm wood tones',
};

// --- Ambiances saisonnieres (lumiere + palette) ---
const SEASON_MOODS = {
  summer: 'bright summer daylight, fresh airy atmosphere, light linen textiles, cool blue and white tones',
  winter: 'cozy winter mood, warm soft lighting, knitted textiles, deep warm tones, candles',
  autumn: 'golden autumn light, warm amber and rust tones, soft wool throws, intimate atmosphere',
  night:  'evening ambient lighting, warm lamp glow, soft shadows, calm intimate mood',
};

// --- Traduit les positions des meubles (x,y normalises ~0-100) en placement decrit ---
const describePlacement = (furniture = []) => {
  if (!furniture.length) return 'arranged in a balanced, harmonious layout with good circulation space';
  const zone = (x, y) => {
    const h = x < 33 ? 'left' : x > 66 ? 'right' : 'center';
    const v = y < 33 ? 'back' : y > 66 ? 'front' : 'middle';
    return `${v} ${h}`;
  };
  const parts = furniture.map(f => `a ${f.id} in the ${zone(f.x || 50, f.y || 50)} of the room`);
  return `with ${parts.join(', ')}, naturally placed with realistic scale and perspective`;
};

const BASE = 'photorealistic interior design photograph, 8k, professional architectural photography, ' +
             'natural balanced lighting, realistic materials and textures';

// Construit le prompt + les options de force selon l'outil.
function buildPromptConfig(action, payload = {}) {
  switch (action) {
    case 'add-furniture': {
      const placement = describePlacement(payload.furniture);
      return {
        prompt: `${BASE}, a beautifully furnished room ${placement}, ` +
                `cohesive color palette, warm and inviting atmosphere`,
        promptStrength: 0.75, // garde bien la piece, ajoute du mobilier
      };
    }
    case 'style-swap': {
      const style = (payload.style || 'moderne').toLowerCase();
      const palette = STYLE_PALETTES[style] || STYLE_PALETTES.moderne;
      return {
        prompt: `${BASE}, ${style} style interior, ${palette}, ` +
                `harmonious furniture arrangement, cohesive color scheme`,
        promptStrength: 0.85,
      };
    }
    case 'seasonal': {
      const season = (payload.season || 'summer').toLowerCase();
      const mood = SEASON_MOODS[season] || SEASON_MOODS.summer;
      return {
        prompt: `${BASE}, same room with ${mood}, consistent furniture layout`,
        promptStrength: 0.6, // change surtout l'ambiance/lumiere
      };
    }
    case 'materials': {
      const mat = payload.material || 'modern light wood floor and soft neutral painted walls';
      return {
        prompt: `${BASE}, room with ${mat}, keep the same furniture and layout, ` +
                `coherent color harmony between walls, floor and furniture`,
        promptStrength: 0.55,
      };
    }
    case 'declutter':
      return {
        prompt: `${BASE}, a clean empty room, bare floor and walls, no furniture, ` +
                `neutral light tones, tidy and spacious`,
        promptStrength: 0.9,
      };
    case 'remove-object':
      return {
        prompt: `${BASE}, the room with the unwanted object removed, ` +
                `background seamlessly reconstructed, consistent lighting and colors`,
        promptStrength: 0.7,
      };
    case 'pool-water':
      return {
        prompt: `${BASE}, the empty pool filled with clear realistic blue water, ` +
                `natural reflections and caustics, surrounding area unchanged`,
        promptStrength: 0.6,
      };
    case 'enhance':
      return {
        prompt: `${BASE}, same room enhanced: sharper details, balanced exposure, ` +
                `vivid yet natural colors, high resolution`,
        promptStrength: 0.35, // amelioration legere, on garde tout
      };
    default:
      return { prompt: `${BASE}, ${payload.prompt || 'beautiful interior'}`, promptStrength: 0.75 };
  }
}

module.exports = { buildPromptConfig };
