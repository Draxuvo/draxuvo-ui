// Catálogo cerrado de iconos de producto (spec 026). Las claves coinciden con config/product_icons.yml de la API.

export const PRODUCT_ICON_GROUPS = {
  comida: ["taco", "burger", "torta", "tamal", "corn", "pizza", "soup", "salad", "chicken", "beef", "fish", "egg", "bread", "fruit", "utensils"],
  bebida: ["soda", "coffee", "beer", "wine", "cocktail", "water", "juice", "cup"],
  postre: ["cake", "ice_cream", "cookie"],
  plomeria_y_oficios: ["pipe", "faucet", "valve", "drain", "heater", "pliers", "ptfe_tape", "wrench", "hammer", "screwdriver", "paint", "bolt", "plug"],
  refacciones_y_materiales: ["filter", "hose", "screws", "gear", "battery", "cable", "bulb", "key", "box"],
  general: ["package", "tag", "star", "tools", "truck", "gift"],
} as const;

export type ProductIconGroup = keyof typeof PRODUCT_ICON_GROUPS;
export type ProductIconKey = (typeof PRODUCT_ICON_GROUPS)[ProductIconGroup][number];

export const PRODUCT_ICON_KEYS: readonly ProductIconKey[] = Object.values(PRODUCT_ICON_GROUPS).flat();

export function isProductIconKey(key: unknown): key is ProductIconKey {
  return typeof key === "string" && (PRODUCT_ICON_KEYS as readonly string[]).includes(key);
}
