export function normalizeWhatsappNumber(value: string) {
  const cleaned = value.replace(/[^\d]/g, "");

  if (cleaned.startsWith("00")) {
    return cleaned.slice(2);
  }

  return cleaned;
}

export function buildWhatsappMessage(input: {
  vendorName: string;
  itemName: string;
  itemUrl: string;
}) {
  return `Hola ${input.vendorName}, me interesa el "${input.itemName}". ¿Está disponible aún? Este es el link del artículo: ${input.itemUrl}`;
}

export function buildWhatsappUrl(input: {
  phone: string;
  vendorName: string;
  itemName: string;
  itemUrl: string;
}) {
  const phone = normalizeWhatsappNumber(input.phone);
  const text = buildWhatsappMessage(input);

  if (!phone) {
    return "";
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
