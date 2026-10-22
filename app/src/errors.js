// Sampling error of a food's nutrient values (docs/notes/error-handling.md): every entry of a food draws its own
// sample, whose amount of nutrient α per gram is lognormal with mean (1 + bias)·label and deviation CV × that mean.
// Bias and CV depend on the food's category and the nutrient.
//
// CVs fitted to USDA SR28 (docs/notes/research_notes/Nutrient content variability/data/scripts/fit_cvs.py): per food,
// SE·√n / mean, n ≥ 3; energy and carbohydrate from the analysed proximates. SR28's samples are often blends of
// three items, so the spread between single items is √3 times theirs (BLEND). Every bias is 0 for now. Categories are
// CIQUAL's subgroups; each falls in a class that sets its CVs.

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

// Median CV over all foods, then each class's median (a class with fewer than 5 foods
// for a nutrient uses the all-foods median).
const BASE = {
  water: 0.031, protein: 0.073, carbs: 0.092, sugars: 0.09, fibre: 0.14, fat: 0.17, energy: 0.043,
  alcohol: 0.076, majorMinerals: 0.1, minerals: 0.18, trace: 0.23, bVitamins: 0.17, folateCarotene: 0.23,
  vitaminC: 0.34, vitaminD: 0.48, other: 0.089,
}
const CLASSES = {
  // Not known: the 75th percentile over all foods.
  unknown: {
    water: 0.067, protein: 0.13, carbs: 0.21, sugars: 0.22, fibre: 0.23, fat: 0.3, energy: 0.084, alcohol: 0.11,
    majorMinerals: 0.18, minerals: 0.3, trace: 0.44, bVitamins: 0.27, folateCarotene: 0.44, vitaminC: 0.58,
    vitaminD: 0.7, other: 0.22,
  },
  produce: {
    water: 0.022, protein: 0.11, carbs: 0.15, sugars: 0.17, fibre: 0.12, fat: 0.29, energy: 0.084,
    majorMinerals: 0.15, minerals: 0.24, trace: 0.7, bVitamins: 0.21, folateCarotene: 0.22, vitaminC: 0.34,
    vitaminD: 0.5,
  },
  fruit: {
    water: 0.014, protein: 0.15, carbs: 0.072, sugars: 0.087, fibre: 0.17, fat: 0.36, energy: 0.054,
    majorMinerals: 0.15, minerals: 0.29, trace: 0.58, bVitamins: 0.21, folateCarotene: 0.3, vitaminC: 0.29,
  },
  nuts: {
    water: 0.15, protein: 0.061, carbs: 0.13, sugars: 0.09, fibre: 0.1, fat: 0.038, energy: 0.012,
    majorMinerals: 0.063, minerals: 0.14, trace: 0.45, bVitamins: 0.13, folateCarotene: 0.23, vitaminC: 0.61,
  },
  grains: {
    water: 0.067, protein: 0.066, carbs: 0.025, sugars: 0.11, fibre: 0.15, fat: 0.15, energy: 0.018,
    majorMinerals: 0.12, minerals: 0.16, trace: 0.31, bVitamins: 0.18, folateCarotene: 0.2, vitaminC: 0.17,
  },
  meat: {
    water: 0.032, protein: 0.057, carbs: 1.3, sugars: 0.44, fat: 0.19, energy: 0.082, majorMinerals: 0.076,
    minerals: 0.15, trace: 0.21, bVitamins: 0.14, folateCarotene: 0.42, vitaminC: 0.25, vitaminD: 0.48,
  },
  fish: {
    water: 0.024, protein: 0.068, carbs: 0.47, fat: 0.26, energy: 0.095, majorMinerals: 0.12, minerals: 0.33,
    trace: 0.2, bVitamins: 0.24, folateCarotene: 0.32, vitaminC: 0.46, vitaminD: 0.67,
  },
  eggs: {
    water: 0.014, protein: 0.032, carbs: 0.77, sugars: 0.23, fat: 0.053, majorMinerals: 0.077, minerals: 0.13,
    trace: 0.29, bVitamins: 0.21, folateCarotene: 0.2,
  },
  dairy: {
    water: 0.027, protein: 0.053, carbs: 0.22, sugars: 0.061, fat: 0.095, energy: 0.038, majorMinerals: 0.1,
    minerals: 0.14, trace: 0.27, bVitamins: 0.16, folateCarotene: 0.32, vitaminC: 0.65,
  },
  fats: {
    water: 0.048, protein: 0.37, carbs: 0.24, sugars: 0.034, fat: 0.049, energy: 0.008, majorMinerals: 0.11,
    minerals: 0.24, bVitamins: 0.24, folateCarotene: 0.5,
  },
  dishes: {
    water: 0.025, protein: 0.062, carbs: 0.087, sugars: 0.084, fibre: 0.14, fat: 0.09, energy: 0.033,
    majorMinerals: 0.061, minerals: 0.095, trace: 0.13, bVitamins: 0.12, folateCarotene: 0.18, vitaminC: 0.4,
  },
  sweets: {
    water: 0.1, protein: 0.1, carbs: 0.046, sugars: 0.041, fibre: 0.15, fat: 0.13, energy: 0.042,
    majorMinerals: 0.18, minerals: 0.23, trace: 0.27, bVitamins: 0.22, folateCarotene: 0.18, vitaminC: 0.51,
  },
  beverages: {
    water: 0.003, protein: 0.23, carbs: 0.048, sugars: 0.046, fat: 0.35, alcohol: 0.076, majorMinerals: 0.21,
    minerals: 0.4, trace: 0.43, bVitamins: 0.24, folateCarotene: 0.32, vitaminC: 0.28, other: 0.049,
  },
  seasonings: {
    water: 0.19, protein: 0.13, carbs: 0.088, fibre: 0.16, fat: 0.23, energy: 0.056, majorMinerals: 0.18,
    minerals: 0.33, trace: 0.25, bVitamins: 0.51, folateCarotene: 0.73, vitaminC: 0.89,
  },
  baby: {
    water: 0.016, protein: 0.09, carbs: 0.16, fat: 0.2, majorMinerals: 0.12, minerals: 0.3, trace: 0.16,
    bVitamins: 0.17, folateCarotene: 0.2, vitaminC: 0.28,
  },
}

// Not in SR28, so estimated, not fitted (and not scaled by BLEND): single-ingredient powders, made to a label.
// Protein powders test below their label more often than above (30% of 70 products > 10% below, 7% 42–80% below:
// Schönfeldt et al. 2019), hence the bias. Creatine: a single synthesised compound.
const SUPPLEMENTS = {
  water: 0.2, protein: 0.15, carbs: 0.15, sugars: 0.15, fibre: 0.2, fat: 0.15, energy: 0.1, other: 0.05,
}
const SUPPLEMENTS_BIAS = { protein: -0.05 }

// CIQUAL groups and subgroups: [code, name, class], plus supplements (99, not CIQUAL's).
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
  ['99', 'Supplements', [['9901', 'creatine, protein powders and similar', 'supplements']]],
]

const CLASS_OF = new Map(CATEGORY_GROUPS.flatMap(([, , subs]) => subs.map(([code, , cls]) => [code, cls])))
export const categoryName = (code) => CATEGORY_GROUPS.flatMap(([, , s]) => s).find(([c]) => c === code)?.[1] ?? 'unknown'

const BLEND = Math.sqrt(3)

/** [bias, CV] of nutrient `key` in a food of category `code` (a CIQUAL subgroup; anything else is unknown). */
export function sampling(code, key) {
  const cls = CLASS_OF.get(code) ?? 'unknown'
  const kind = KIND[key] ?? 'other'
  if (cls === 'supplements' && SUPPLEMENTS[kind]) return [SUPPLEMENTS_BIAS[kind] ?? 0, SUPPLEMENTS[kind]]
  return [0, (CLASSES[cls]?.[kind] ?? BASE[kind]) * BLEND]
}
