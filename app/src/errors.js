// Sampling error of a food's nutrient values (docs/notes/error-handling.md): a food is one sample, shared by all its
// entries, whose amount of nutrient α per gram is lognormal with mean (1 + bias)·label and deviation CV × that mean.
// Bias and CV depend on the food's category and the nutrient.
//
// CVs from USDA data (docs/notes/research_notes/Nutrient content variability/data/scripts/cv_table.py): the spread
// between FoodData Central Foundation Foods samples, mostly single purchases, where a class has 10 foods or more;
// otherwise SR28's SE·√n / mean × 1.05, the median ratio of the two where both exist. Biases are 0 but for
// supplements. Categories are CIQUAL's subgroups; each falls in a class that sets its CVs.

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
  vitaminC: 'vitaminC', vitaminD: 'vitaminD', caffeine: 'caffeine', creatine: 'other',
}

// Median CV over all foods, then each class's median; unknown is the 75th percentile over all foods.
const BASE = {
  water: 0.022, protein: 0.11, carbs: 0.096, sugars: 0.15, fibre: 0.14, fat: 0.2, energy: 0.063, alcohol: 0.08,
  majorMinerals: 0.13, minerals: 0.23, trace: 0.53, bVitamins: 0.2, folateCarotene: 0.27, vitaminC: 0.27,
  vitaminD: 0.5, other: 0.093,
}
const CLASSES = {
  unknown: {
    water: 0.063, protein: 0.2, carbs: 0.19, sugars: 0.29, fibre: 0.22, fat: 0.39, energy: 0.11, alcohol: 0.11,
    majorMinerals: 0.2, minerals: 0.36, trace: 0.97, bVitamins: 0.28, folateCarotene: 0.48, vitaminC: 0.4,
    vitaminD: 0.74, other: 0.23,
  },
  produce: {
    water: 0.015, protein: 0.16, carbs: 0.12, sugars: 0.16, fibre: 0.15, fat: 0.29, energy: 0.1,
    majorMinerals: 0.14, minerals: 0.3, trace: 1.1, bVitamins: 0.2, folateCarotene: 0.25, vitaminC: 0.25,
    vitaminD: 0.52,
  },
  fruit: {
    water: 0.014, protein: 0.2, carbs: 0.084, sugars: 0.12, fibre: 0.15, fat: 0.48, energy: 0.073,
    majorMinerals: 0.14, minerals: 0.34, trace: 0.61, bVitamins: 0.23, folateCarotene: 0.35, vitaminC: 0.27,
  },
  nuts: {
    water: 0.15, protein: 0.059, carbs: 0.074, sugars: 0.094, fibre: 0.089, fat: 0.054, energy: 0.023,
    majorMinerals: 0.058, minerals: 0.11, trace: 0.81, bVitamins: 0.14, folateCarotene: 0.24, vitaminC: 0.64,
  },
  grains: {
    water: 0.092, protein: 0.1, carbs: 0.022, sugars: 0.14, fibre: 0.18, fat: 0.14, energy: 0.012,
    majorMinerals: 0.14, minerals: 0.22, trace: 0.72, bVitamins: 0.2, folateCarotene: 0.23, vitaminC: 0.18,
  },
  bakery: {
    water: 0.052, protein: 0.083, carbs: 0.049, sugars: 0.094, fibre: 0.15, fat: 0.23, energy: 0.037,
    majorMinerals: 0.16, minerals: 0.17, trace: 0.22, bVitamins: 0.17, folateCarotene: 0.18,
  },
  meat: {
    water: 0.027, protein: 0.043, carbs: 1.3, sugars: 0.53, fat: 0.19, energy: 0.087, majorMinerals: 0.064,
    minerals: 0.15, trace: 0.22, bVitamins: 0.16, folateCarotene: 0.44, vitaminC: 0.27, vitaminD: 0.5,
  },
  fish: {
    water: 0.022, protein: 0.076, carbs: 0.49, fat: 0.27, energy: 0.084, majorMinerals: 0.13, minerals: 0.36,
    trace: 0.17, bVitamins: 0.33, folateCarotene: 0.34, vitaminC: 0.49, vitaminD: 0.7,
  },
  eggs: {
    water: 0.015, protein: 0.034, carbs: 0.81, sugars: 0.25, fat: 0.056, energy: 0.024, majorMinerals: 0.081,
    minerals: 0.13, trace: 0.3, bVitamins: 0.22, folateCarotene: 0.21,
  },
  dairy: {
    water: 0.023, protein: 0.084, carbs: 0.25, sugars: 0.2, fat: 0.076, energy: 0.042, majorMinerals: 0.13,
    minerals: 0.19, trace: 0.26, bVitamins: 0.17, folateCarotene: 0.32, vitaminC: 0.68,
  },
  fats: {
    water: 0.05, protein: 0.39, carbs: 0.25, sugars: 0.036, fat: 0.068, energy: 0.019, majorMinerals: 0.12,
    minerals: 0.25, bVitamins: 0.22, folateCarotene: 0.52,
  },
  dishes: {
    water: 0.026, protein: 0.065, carbs: 0.091, sugars: 0.088, fibre: 0.14, fat: 0.094, energy: 0.037,
    majorMinerals: 0.064, minerals: 0.1, trace: 0.14, bVitamins: 0.13, folateCarotene: 0.19, vitaminC: 0.42,
  },
  sweets: {
    water: 0.11, protein: 0.11, carbs: 0.048, sugars: 0.043, fibre: 0.15, fat: 0.14, energy: 0.028,
    majorMinerals: 0.19, minerals: 0.25, trace: 0.29, bVitamins: 0.23, folateCarotene: 0.19, vitaminC: 0.54,
  },
  beverages: {
    water: 0.0031, protein: 0.24, carbs: 0.05, sugars: 0.048, fat: 0.37, energy: 0.035, alcohol: 0.08,
    majorMinerals: 0.22, minerals: 0.42, trace: 0.46, bVitamins: 0.25, folateCarotene: 0.34, vitaminC: 0.3,
    other: 0.051,
  },
  seasonings: {
    water: 0.2, protein: 0.13, carbs: 0.092, fibre: 0.17, fat: 0.24, energy: 0.054, majorMinerals: 0.19,
    minerals: 0.34, trace: 0.27, bVitamins: 0.54, folateCarotene: 0.77, vitaminC: 0.93,
  },
  baby: {
    water: 0.017, protein: 0.094, carbs: 0.17, fat: 0.21, energy: 0.1, majorMinerals: 0.12, minerals: 0.31,
    trace: 0.17, bVitamins: 0.18, folateCarotene: 0.21, vitaminC: 0.29,
  },
}

// Not in USDA's data, so estimated, not fitted: single-ingredient powders, made to a label.
// Protein powders test below their label more often than above (30% of 70 products > 10% below, 7% 42–80% below:
// Schönfeldt et al. 2019), hence the bias. Creatine: a single synthesised compound.
const SUPPLEMENTS = {
  water: 0.2, protein: 0.15, carbs: 0.15, sugars: 0.15, fibre: 0.2, fat: 0.15, energy: 0.1, other: 0.05, caffeine: 0.05,
}
const SUPPLEMENTS_BIAS = { protein: -0.05 }

// Caffeine in any other food is an estimate of a brew: moka coffee measured 128–540 mg/100 mL across coffees and
// brews (Angeloni et al. 2019). Estimated, not fitted.
const CAFFEINE = 0.3

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
    ['0301', 'pasta, rice and grains', 'grains'], ['0302', 'breads and similar', 'bakery'],
    ['0303', 'savoury biscuits', 'grains'], ['0304', 'flours', 'grains'], ['0305', 'pastry dough', 'bakery'],
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

// Entry error: how far the entry may be from what was eaten (a generic or approximate entry, brand, cut, recipe), per
// food, 0 for one read off the exact product's label. Every log draws its own. 10% by default: the Dutch duplicate-diet
// check of computed against analysed days (J Food Comp Anal 2015, 43:68) puts a weighed day at ~4% SD, i.e. ~13% per
// food over ~10 foods, ~10% of it not in the CVs above.
export const DEFAULT_ENTRY_ERROR = 0.1
export const entryError = (item) => (Number.isFinite(item?.entryError) ? item.entryError : DEFAULT_ENTRY_ERROR)

/** [bias, CV] of nutrient `key` in a food of category `code` (a CIQUAL subgroup; anything else is unknown). */
export function sampling(code, key) {
  const cls = CLASS_OF.get(code) ?? 'unknown'
  const kind = KIND[key] ?? 'other'
  if (cls === 'supplements' && SUPPLEMENTS[kind]) return [SUPPLEMENTS_BIAS[kind] ?? 0, SUPPLEMENTS[kind]]
  if (kind === 'caffeine') return [0, CAFFEINE]
  return [0, CLASSES[cls]?.[kind] ?? BASE[kind]]
}
