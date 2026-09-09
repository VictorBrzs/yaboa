export type GeocodedAddress = {
  lat: number;
  lng: number;
  displayName: string;
};

export type CepAddress = {
  street: string;
  district: string;
  city: string;
  state: string;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
};

type ViaCepResult = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export async function lookupCep(cep: string): Promise<CepAddress> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) throw new Error("Informe um CEP com 8 numeros.");

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!response.ok) throw new Error("Nao foi possivel buscar o CEP agora.");

  const result = (await response.json()) as ViaCepResult;
  if (result.erro) throw new Error("CEP nao encontrado.");

  return {
    street: result.logradouro || "",
    district: result.bairro || "",
    city: result.localidade || "",
    state: result.uf || "",
  };
}

export function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function buildAddress(parts: CepAddress & { number: string; complement: string }) {
  return [
    [parts.street, parts.number].filter(Boolean).join(", "),
    parts.complement,
    parts.district,
    [parts.city, parts.state].filter(Boolean).join(" - "),
  ]
    .filter(Boolean)
    .join(", ");
}

export async function geocodeAddress(venueName: string, address: string): Promise<GeocodedAddress> {
  const normalizedAddress = normalizeAddress(address);
  const parsedAddress = parseBrazilianAddress(normalizedAddress);
  const queries = buildAddressQueries(venueName, normalizedAddress, parsedAddress);

  if (!queries.length) throw new Error("Informe um endereco valido para colocar a festa no mapa.");

  for (const query of queries) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "3");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "br");
    url.searchParams.set("accept-language", "pt-BR");

    if (typeof query === "string") {
      url.searchParams.set("q", query);
    } else {
      Object.entries(query).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error("Nao foi possivel validar o endereco agora. Tente novamente.");

    const results = (await response.json()) as NominatimResult[];
    const firstResult = results[0];
    if (!firstResult) continue;

    const lat = Number(firstResult.lat);
    const lng = Number(firstResult.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("O endereco encontrado nao retornou coordenadas validas.");
    }

    return {
      lat,
      lng,
      displayName: firstResult.display_name || normalizedAddress,
    };
  }

  throw new Error("Endereco nao encontrado. Confira rua, numero, bairro, cidade e UF. Se preferir, busque pelo CEP e complete o numero.");
}

type StructuredAddress = {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
};

function normalizeAddress(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bcep\s*:?\s*\d{5}-?\d{3}\b/gi, "")
    .replace(/\b(apto|apartamento|bloco|sala|casa|fundos|loja)\b\.?\s*[^,]*/gi, "")
    .replace(/\bav\.?\b/gi, "Avenida")
    .replace(/\br\.?\b/gi, "Rua")
    .replace(/\brod\.?\b/gi, "Rodovia")
    .replace(/\bpc\.?\b/gi, "Praca")
    .replace(/\btrav\.?\b/gi, "Travessa")
    .replace(/\s+-\s+/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/,+/g, ",")
    .replace(/\s*,\s*/g, ", ")
    .replace(/^,|,$/g, "")
    .trim();
}

function parseBrazilianAddress(address: string): StructuredAddress {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const cityStateMatch = address.match(/,\s*([^,]+?)\s*-\s*([A-Z]{2})(?:,|$)/i);
  const state = cityStateMatch?.[2]?.toUpperCase();
  const city = cityStateMatch?.[1]?.trim() || parts.at(-1)?.replace(/\s+-\s+[A-Z]{2}$/i, "").trim();
  const street = parts.slice(0, 2).join(", ") || parts[0];

  return {
    street,
    city,
    state,
    country: "Brasil",
  };
}

function buildAddressQueries(venueName: string, address: string, parsed: StructuredAddress) {
  const withoutNumber = address.replace(/,\s*\d+[A-Za-z]?\b/, "");
  const cityState = [parsed.city, parsed.state].filter(Boolean).join(", ");
  const queries: Array<string | StructuredAddress> = [
    address,
    [venueName, address].filter(Boolean).join(", "),
    [address, "Brasil"].filter(Boolean).join(", "),
    [withoutNumber, cityState, "Brasil"].filter(Boolean).join(", "),
    parsed.street && parsed.city ? parsed : "",
    parsed.street && parsed.city ? { ...parsed, street: withoutNumber.split(",")[0] } : "",
  ];

  const seen = new Set<string>();
  return queries.filter((query): query is string | StructuredAddress => {
    if (!query) return false;
    const key = typeof query === "string" ? query.toLowerCase() : JSON.stringify(query).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
