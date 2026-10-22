// Sampling error of a food's nutrient values (docs/notes/error-handling.md): every entry of a food draws its own
// sample, whose amount of nutrient α per gram is lognormal with mean (1 + bias)·label and deviation CV × that mean.
// Bias and CV depend on the food's category and the nutrient.
//
// v1 priors, from the per-nutrient uncertainty budget of docs/notes/reports/Nutrient content variability.md (single
// weighed item, well-identified food), widened where the report says to (ripeness, cut, origin unknown). Every bias
// is 0 for now. Categories are CIQUAL's subgroups; each falls in a class that sets its CVs.

// Nutrients that share a CV.
const KIND = {
  water: 'water', proteins: 'protein', carbohydrates: 'carbs', sugars: 'sugars', addedSugars: 'sugars', fibers: 'fibre',
  fat: 'fat', saturatedFat: 'fat', monounsaturatedFat: 'fat', polyunsaturatedFat: 'fat', omega3: 'fat', transFat: 'fat',
  cholesterol: 'fat', energy: 'energy', alcohol: 'alcohol',
  potassium: 'majorMinerals', phosphorus: 'majorMinerals', magnesium: 'majorMinerals',
  sodium: 'minerals', salt: 'minerals', chloride: 'minerals', calcium: 'minerals', iron: 'minerals', zinc: 'minerals',
  copper: 'minerals', manganese: 'minerals',
  selenium: 'trace', iodine: 'trace', fluoride: 'trace', chromium: 'trace', molybdenum: 'trace',
  vitaminB1: 'bVitamins', vitaminB2: 'bVitamins', vitaminB3: 'bVitamins', vitaminB5: 'bVitamins', vitaminB6: 'bVitamins',
  vitaminB7: 'bVitamins', vitaminB12: 'bVitamins', vitaminE: 'bVitamins',
  vitaminA: 'folateCarotene', vitaminB9: 'folateCarotene', vitaminK: 'folateCarotene',
  vitaminC: 'vitaminC', vitaminD: 'vitaminD', caffeine: 'other', creatine: 'other',
}

// Default CVs (the report's table), then each class's overrides.
const BASE = {
  water: 0.03, protein: 0.1, carbs: 0.1, sugars: 0.12, fibre: 0.2, fat: 0.2, energy: 0.1, alcohol: 0.05,
  majorMinerals: 0.12, minerals: 0.18, trace: 0.8, bVitamins: 0.2, folateCarotene: 0.28, vitaminC: 0.35, vitaminD: 0.8,
  other: 0.25,
}
const CLASSES = {
  // Not known: wide everywhere.
  unknown: {
    water: 0.1, protein: 0.25, carbs: 0.25, sugars: 0.35, fibre: 0.35, fat: 0.4, energy: 0.25, alcohol: 0.15,
    majorMinerals: 0.3, minerals: 0.35, trace: 1, bVitamins: 0.35, folateCarotene: 0.45, vitaminC: 0.5, vitaminD: 1, other: 0.4,
  },
  // Watery produce: dry matter alone varies 6–24%, fat is in traces.
  produce: { protein: 0.15, carbs: 0.15, sugars: 0.25, fat: 0.4, energy: 0.15, minerals: 0.2 },
  // Ripeness moves sugar and starch.
  fruit: { protein: 0.15, carbs: 0.12, sugars: 0.25, fat: 0.4, energy: 0.12 },
  nuts: { protein: 0.08, fat: 0.08, energy: 0.08, trace: 1 },
  grains: { protein: 0.12, carbs: 0.05, fat: 0.15, energy: 0.05 },
  // Fat follows cut and trim.
  meat: { protein: 0.07, fat: 0.25, energy: 0.15, trace: 0.25 },
  // Fat follows season, wild vs farmed; iodine and vitamin D vary a lot.
  fish: { protein: 0.07, fat: 0.3, energy: 0.15, trace: 0.4 },
  eggs: { protein: 0.06, fat: 0.08, energy: 0.06, trace: 0.4, vitaminD: 0.5 },
  dairy: { protein: 0.07, fat: 0.08, sugars: 0.1, energy: 0.07, trace: 0.5, vitaminD: 0.5 },
  fats: { fat: 0.02, energy: 0.02 },
  // A recipe of someone else's: proportions vary.
  dishes: { protein: 0.2, carbs: 0.2, sugars: 0.3, fat: 0.3, energy: 0.2, minerals: 0.25 },
  sweets: { protein: 0.12, carbs: 0.06, sugars: 0.08, fat: 0.12, energy: 0.06 },
  beverages: { water: 0.01, sugars: 0.08, energy: 0.08, minerals: 0.3, other: 0.3 },
  seasonings: { minerals: 0.2 },
  // Regulated composition.
  baby: { protein: 0.1, carbs: 0.1, sugars: 0.1, fat: 0.1, energy: 0.1, bVitamins: 0.2, folateCarotene: 0.2, vitaminC: 0.25, vitaminD: 0.25 },
}

// CIQUAL groups and subgroups: [code, name, class].
export const CATEGORY_GROUPS = [
  ['01', 'Starters and dishes', [
    ['0101', 'mixed salads', 'dishes'], ['0102', 'soups', 'dishes'], ['0103', 'dishes', 'dishes'],
    ['0104', 'pizzas, crepe and pies', 'dishes'], ['0105', 'sandwiches', 'dishes'],
    ['0106', 'savoury pastries and other starters', 'dishes'],
  ]],
  ['02', 'Fruits, vegetables, legumes and nuts', [
    ['0201', 'vegetables', 'produce'], ['0202', 'potatoes and other tubers', 'produce'], ['0203', 'legumes', 'produce'],
    ['0204', 'fruits', 'fruit'], ['0205', 'nuts and seeds', 'nuts'],
  ]],
  ['03', 'Cereal products', [
    ['0301', 'pasta, rice and grains', 'grains'], ['0302', 'breads and similar', 'grains'],
    ['0303', 'savoury biscuits', 'grains'], ['0304', 'flours', 'grains'], ['0305', 'pastry dough', 'grains'],
  ]],
  ['04', 'Meat, egg and fish', [
    ['0401', 'cooked meat', 'meat'], ['0402', 'raw meat', 'meat'], ['0403', 'delicatessen meat and similar', 'meat'],
    ['0404', 'other meat products', 'meat'], ['0405', 'fish, cooked', 'fish'], ['0406', 'fish, raw', 'fish'],
    ['0407', 'seafood, cooked', 'fish'], ['0408', 'seafood, raw', 'fish'], ['0409', 'fish products', 'fish'],
    ['0410', 'eggs', 'eggs'], ['0411', 'plant-based alternatives to meat products', 'dishes'],
  ]],
  ['05', 'Milk and milk products', [
    ['0501', 'milk', 'dairy'], ['0502', 'dairy products', 'dairy'], ['0503', 'cheese and similar', 'dairy'],
    ['0504', 'cream and similar', 'dairy'],
  ]],
  ['06', 'Beverages', [
    ['0601', 'water', 'beverages'], ['0602', 'non-alcoholic beverages', 'beverages'], ['0603', 'alcoholic beverages', 'beverages'],
  ]],
  ['07', 'Sugar and confectionery', [
    ['0701', 'sugars and honey', 'sweets'], ['0702', 'chocolate and chocolate products', 'sweets'],
    ['0703', 'non-chocolate confectionery', 'sweets'], ['0704', 'jam', 'sweets'], ['0705', 'Viennese pastries', 'sweets'],
    ['0706', 'sweet biscuits', 'sweets'], ['0707', 'breakfast cereals', 'grains'], ['0708', 'cereal bars', 'sweets'],
    ['0709', 'cakes and pastry', 'sweets'],
  ]],
  ['08', 'Ice cream and sorbet', [
    ['0801', 'ice cream', 'dairy'], ['0802', 'sorbet', 'sweets'], ['0803', 'frozen desserts', 'sweets'],
  ]],
  ['09', 'Fats and oils', [
    ['0901', 'butters', 'fats'], ['0902', 'vegetable oils', 'fats'], ['0903', 'margarines', 'fats'],
    ['0904', 'fish oils', 'fats'], ['0905', 'other fats', 'fats'],
  ]],
  ['10', 'Miscellaneous', [
    ['1001', 'sauces', 'dishes'], ['1002', 'condiments', 'seasonings'], ['1003', 'cooking aids', 'seasonings'],
    ['1004', 'salts', 'seasonings'], ['1005', 'spices', 'seasonings'], ['1006', 'herbs', 'produce'],
    ['1007', 'seaweed', 'produce'], ['1008', 'foods for particular nutritional uses', 'unknown'],
    ['1009', 'ingredients for vegetarian', 'dishes'], ['1010', 'plant-based spreads', 'dishes'],
  ]],
  ['11', 'Baby food', [
    ['1101', 'baby milk and beverages', 'baby'], ['1102', 'baby dishes', 'baby'], ['1103', 'baby deserts', 'baby'],
    ['1104', 'baby biscuits and cereals', 'baby'],
  ]],
]

const CLASS_OF = new Map(CATEGORY_GROUPS.flatMap(([, , subs]) => subs.map(([code, , cls]) => [code, cls])))
export const categoryName = (code) => CATEGORY_GROUPS.flatMap(([, , s]) => s).find(([c]) => c === code)?.[1] ?? 'unknown'

/** [bias, CV] of nutrient `key` in a food of category `code` (a CIQUAL subgroup; anything else is unknown). */
export function sampling(code, key) {
  const cls = CLASSES[CLASS_OF.get(code) ?? 'unknown']
  const kind = KIND[key] ?? 'other'
  return [0, cls[kind] ?? BASE[kind]]
}
