export type AppCategory = {
  id: string;
  name: string;
  image: string;
};

const categoryImage = (seed: string) =>
  `https://images.unsplash.com/${seed}?auto=format&fit=crop&w=300&q=80`;

function slugifyCategory(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCategory(name: string, image: string): AppCategory {
  return {
    id: slugifyCategory(name),
    name,
    image,
  };
}

export const appCategories: AppCategory[] = [
  buildCategory("Vehículos", categoryImage("photo-1494976388531-d1058494cdd8")),
  buildCategory("Motocicletas", categoryImage("photo-1558981806-ec527fa84c39")),
  buildCategory("Camiones", categoryImage("photo-1519003722824-194d4455a60c")),
  buildCategory("Vehículos recreativos (RV / campers)", categoryImage("photo-1500530855697-b586d89ba3ee")),
  buildCategory("Botes y embarcaciones", categoryImage("photo-1500375592092-40eb2168fd21")),
  buildCategory("Piezas y accesorios", categoryImage("photo-1486262715619-67b85e0b08d3")),
  buildCategory("Servicios automotrices", categoryImage("photo-1487754180451-c456f719a1fc")),
  buildCategory("Propiedades en venta", categoryImage("photo-1560518883-ce09059eeffa")),
  buildCategory("Propiedades en alquiler", categoryImage("photo-1460317442991-0ec209397118")),
  buildCategory("Habitaciones compartidas", categoryImage("photo-1505693416388-ac5ce068fe85")),
  buildCategory("Terrenos", categoryImage("photo-1500382017468-9049fed747ef")),
  buildCategory("Propiedades comerciales", categoryImage("photo-1486406146926-c627a92ad1ab")),
  buildCategory("Ropa para hombres", categoryImage("photo-1515886657613-9f3515b0c78f")),
  buildCategory("Ropa para mujeres", categoryImage("photo-1483985988355-763728e1935b")),
  buildCategory("Ropa para niños", categoryImage("photo-1519238359922-989348752efb")),
  buildCategory("Zapatos", categoryImage("photo-1549298916-b41d501d3772")),
  buildCategory("Bolsos y carteras", categoryImage("photo-1584917865442-de89df76afd3")),
  buildCategory("Joyas y relojes", categoryImage("photo-1523170335258-f5ed11844a49")),
  buildCategory("Accesorios", categoryImage("photo-1523275335684-37898b6baf30")),
  buildCategory("Maquillaje", categoryImage("photo-1522335789203-aabd1fc54bc9")),
  buildCategory("Belleza", categoryImage("photo-1560750588-73207b1ef5b8")),
  buildCategory("Celulares y smartphones", categoryImage("photo-1511707171634-5f897ff02aa9")),
  buildCategory("Computadoras y laptops", categoryImage("photo-1496181133206-80ce9b88a853")),
  buildCategory("Tablets", categoryImage("photo-1544244015-0df4b3ffc6b0")),
  buildCategory("Televisores", categoryImage("photo-1593784991095-a205069470b6")),
  buildCategory("Cámaras y fotografía", categoryImage("photo-1516035069371-29a1b244cc32")),
  buildCategory("Audio (bocinas, audífonos)", categoryImage("photo-1505740420928-5e560c06d30e")),
  buildCategory("Videojuegos y consolas", categoryImage("photo-1606144042614-b2417e99c4e3")),
  buildCategory("Accesorios electrónicos", categoryImage("photo-1517336714739-489689fd1ca8")),
  buildCategory("Hogar", categoryImage("photo-1505693416388-ac5ce068fe85")),
  buildCategory("Muebles", categoryImage("photo-1505693416388-ac5ce068fe85")),
  buildCategory("Cocina y comedor", categoryImage("photo-1473093295043-cdd812d0e601")),
  buildCategory("Electrodomésticos", categoryImage("photo-1586201375761-83865001e31c")),
  buildCategory("Decoración", categoryImage("photo-1513694203232-719a280e022f")),
  buildCategory("Organización del hogar", categoryImage("photo-1556909114-f6e7ad7d3136")),
  buildCategory("Iluminación", categoryImage("photo-1507473885765-e6ed057f782c")),
  buildCategory("Herramientas", categoryImage("photo-1504148455328-c376907d081c")),
  buildCategory("Materiales de construcción", categoryImage("photo-1504307651254-35680f356dfd")),
  buildCategory("Equipos de reparación", categoryImage("photo-1530124566582-a618bc2615dc")),
  buildCategory("Seguridad del hogar", categoryImage("photo-1558002038-1055e2e28ed1")),
  buildCategory("Muebles de exterior", categoryImage("photo-1494526585095-c41746248156")),
  buildCategory("Plantas", categoryImage("photo-1463154545680-d59320fd685d")),
  buildCategory("Herramientas de jardinería", categoryImage("photo-1416879595882-3373a0480b5b")),
  buildCategory("Parrillas y BBQ", categoryImage("photo-1529193591184-b1d58069ecdd")),
  buildCategory("Decoración exterior", categoryImage("photo-1505693416388-ac5ce068fe85")),
  buildCategory("Alimentos para mascotas", categoryImage("photo-1583511655857-d19b40a7a54e")),
  buildCategory("Accesorios para mascotas", categoryImage("photo-1517849845537-4d257902454a")),
  buildCategory("Juguetes para mascotas", categoryImage("photo-1548199973-03cce0bbc87b")),
  buildCategory("Casas y jaulas", categoryImage("photo-1450778869180-41d0601e046e")),
  buildCategory("Servicios para mascotas", categoryImage("photo-1516734212186-a967f81ad0d7")),
  buildCategory("Juguetes infantiles", categoryImage("photo-1515488042361-ee00e0ddd4e4")),
  buildCategory("Juegos de mesa", categoryImage("photo-1610890716171-6b1bb98ffd09")),
  buildCategory("Figuras coleccionables", categoryImage("photo-1608889825205-eebdb9fc5806")),
  buildCategory("Rompecabezas", categoryImage("photo-1581009146145-b5ef050c2e1e")),
  buildCategory("Libros", categoryImage("photo-1512820790803-83ca734da794")),
  buildCategory("Películas", categoryImage("photo-1489599849927-2ee91cede3ba")),
  buildCategory("Música", categoryImage("photo-1493225457124-a3eb161ffa5f")),
  buildCategory("Revistas", categoryImage("photo-1517841905240-472988babdf9")),
  buildCategory("Guitarras", categoryImage("photo-1510915361894-db8b60106cb1")),
  buildCategory("Teclados", categoryImage("photo-1511379938547-c1f69419868d")),
  buildCategory("Baterías", categoryImage("photo-1519892300165-cb5542fb47c7")),
  buildCategory("Equipos de sonido musical", categoryImage("photo-1507838153414-b4b713384a76")),
  buildCategory("Equipos de gimnasio", categoryImage("photo-1517836357463-d25dfeac3438")),
  buildCategory("Bicicletas", categoryImage("photo-1507035895480-2b3156c31fc8")),
  buildCategory("Equipos deportivos", categoryImage("photo-1461896836934-ffe607ba8211")),
  buildCategory("Camping y outdoor", categoryImage("photo-1500534314209-a25ddb2bd429")),
  buildCategory("Carritos (strollers)", categoryImage("photo-1519689680058-324335c77eba")),
  buildCategory("Sillas de carro", categoryImage("photo-1519238263530-99bdd11df2ea")),
  buildCategory("Ropa de bebé", categoryImage("photo-1519238359922-989348752efb")),
  buildCategory("Juguetes para bebé", categoryImage("photo-1519345182560-3f2917c472ef")),
  buildCategory("Artículos de cuidado", categoryImage("photo-1515377905703-c4788e51af15")),
  buildCategory("Muebles de oficina", categoryImage("photo-1497366754035-f200968a6e72")),
  buildCategory("Material de oficina", categoryImage("photo-1455390582262-044cdead277a")),
  buildCategory("Impresoras y equipos", categoryImage("photo-1612815154858-60aa4c59eaa6")),
  buildCategory("Artes y manualidades", categoryImage("photo-1460661419201-fd4cecdf8a8b")),
  buildCategory("Materiales DIY", categoryImage("photo-1452860606245-08befc0ff44b")),
  buildCategory("Colecciones", categoryImage("photo-1523275335684-37898b6baf30")),
  buildCategory("Empleos", categoryImage("photo-1521791136064-7986c2920216")),
  buildCategory("Servicios", categoryImage("photo-1556740749-887f6717d7e4")),
  buildCategory("Eventos", categoryImage("photo-1492684223066-81342ee5ff30")),
  buildCategory("Artículos gratis", categoryImage("photo-1516321318423-f06f85e504b3")),
  buildCategory("Grupos locales", categoryImage("photo-1511632765486-a01980e01a18")),
  buildCategory("Comunidades de compra y venta", categoryImage("photo-1520607162513-77705c0f0d4a")),
];

export function normalizeCategoryName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

  if (normalized === "autos" || normalized === "auto" || normalized === "carros") return "vehiculos";
  if (normalized === "mujer") return "ropa para mujeres";
  if (normalized === "hombre" || normalized === "hombres") return "ropa para hombres";
  if (normalized === "celulares") return "celulares y smartphones";
  if (normalized === "electronicos") return "accesorios electronicos";
  if (normalized === "cocina") return "cocina y comedor";

  return normalized;
}

export function getCanonicalCategoryName(value: string) {
  const normalized = normalizeCategoryName(value);
  const category = appCategories.find((item) => normalizeCategoryName(item.name) === normalized);

  return category?.name || value.trim();
}

export type CategoryInputKind = "default" | "vehicle" | "clothing" | "shoes";

export function getCategoryInputKind(categoryName?: string): CategoryInputKind {
  const normalized = normalizeCategoryName(categoryName || "");

  if (
    [
      "autos",
      "vehiculos",
      "motocicletas",
      "camiones",
      "vehiculos recreativos (rv / campers)",
      "botes y embarcaciones",
    ].includes(normalized)
  ) {
    return "vehicle";
  }

  if (normalized.startsWith("ropa ")) return "clothing";
  if (normalized === "zapatos") return "shoes";
  return "default";
}

export function sortCategoriesByInterest(categories: AppCategory[], interests: string[]) {
  if (interests.length === 0) return categories;

  const interestOrder = new Map(
    interests.slice(0, 8).map((interest, index) => [normalizeCategoryName(interest), index])
  );

  return [...categories].sort((a, b) => {
    const aOrder = interestOrder.get(normalizeCategoryName(a.name));
    const bOrder = interestOrder.get(normalizeCategoryName(b.name));

    if (aOrder !== undefined && bOrder !== undefined) {
      return aOrder - bOrder;
    }

    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;

    return a.name.localeCompare(b.name, "es");
  });
}
