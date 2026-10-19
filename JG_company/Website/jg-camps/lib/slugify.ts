// lib/slugify.ts
export default function slugify(s: string) {
  const map: Record<string, string> = {
    "Jammu & Kashmir": "jammu-and-kashmir",
    "Leh & Ladakh": "leh-ladakh",
    // explicit mappings for west-region union territories / names we use
    "Daman & Diu": "daman-and-diu",
    "Daman and Diu": "daman-and-diu",
    "Dadra and Nagar Haveli": "dadra-nagar-haveli",
    "Dadra & Nagar Haveli": "dadra-nagar-haveli",
  };
  if (map[s]) return map[s];
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}