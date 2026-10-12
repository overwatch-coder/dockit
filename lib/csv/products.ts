import type { Product } from "@/types/product";

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const CSV_HEADER = [
  "Title",
  "Price",
  "Status",
  "Category",
  "Tags",
  "Variants",
  "Last Synced",
];

function toCsvRow(product: Product): string[] {
  const variantsSummary = product.variants
    .map(
      (variant) =>
        `${variant.optionName} (${variant.price}, qty ${variant.inventory})`,
    )
    .join("; ");

  return [
    product.title,
    product.price,
    product.status === "ACTIVE" ? "Active" : "Draft",
    product.collectionTitle ?? "",
    product.tags.join("; "),
    variantsSummary,
    product.lastSyncedAt ? product.lastSyncedAt.toISOString() : "",
  ];
}

export function buildProductsCsv(products: Product[]): string {
  const rows = [CSV_HEADER, ...products.map(toCsvRow)];
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}

export type CsvImportVariantInput = {
  optionName: string;
  price: string;
  inventory: number;
};

export type CsvImportProductInput = {
  title: string;
  description: string;
  price: string;
  status: "DRAFT" | "ACTIVE";
  collectionTitle?: string | null;
  tags?: string[];
  variants?: CsvImportVariantInput[];
};

export type CsvRowValidationError = {
  rowNumber: number;
  title?: string;
  messages: string[];
};

export type CsvParseAndValidateResult = {
  validProducts: CsvImportProductInput[];
  errors: CsvRowValidationError[];
  totalRows: number;
};

/**
 * Parses an RFC 4180 compliant CSV string into a 2D array of fields.
 * Handles quoted fields, internal doubled quotes (""), newlines, and CRLF line breaks.
 */
export function parseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const char = csvText[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < csvText.length && csvText[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
        i++;
        continue;
      } else if (char === "\r") {
        if (i + 1 < csvText.length && csvText[i + 1] === "\n") {
          i++;
        }
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
        i++;
        continue;
      } else if (char === "\n") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

const HEADER_ALIASES: Record<string, string[]> = {
  title: ["title", "product title", "name", "product name"],
  price: ["price", "product price", "unit price", "msrp", "cost", "amount"],
  status: ["status", "product status", "state"],
  collectionTitle: [
    "category",
    "collection",
    "product category",
    "product type",
    "collection title",
    "category title",
  ],
  tags: ["tags", "product tags", "keywords"],
  variants: ["variants", "options", "product variants", "variant summary"],
  description: [
    "description",
    "product description",
    "body",
    "body (html)",
    "details",
  ],
};

function resolveHeaderIndex(headers: string[], canonicalKey: string): number {
  const aliases = HEADER_ALIASES[canonicalKey] ?? [canonicalKey];
  for (let i = 0; i < headers.length; i++) {
    const normalized = headers[i].trim().toLowerCase();
    if (aliases.includes(normalized)) {
      return i;
    }
  }
  return -1;
}

function parseVariantString(
  variantStr: string,
  defaultPrice: string,
): CsvImportVariantInput[] {
  if (!variantStr.trim()) return [];
  const parts = variantStr.split(";");
  const variants: CsvImportVariantInput[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // Regex matches "Small (10.00, qty 5)" or "Small"
    const match = trimmed.match(
      /^(.*?)(?:\s*\(\s*([\d.]+)\s*,\s*qty\s*(\d+)\s*\))?$/,
    );
    if (match) {
      const optionName = match[1].trim();
      const price = match[2] ? match[2].trim() : defaultPrice;
      const inventory = match[3] ? parseInt(match[3], 10) : 0;
      if (optionName) {
        variants.push({
          optionName,
          price,
          inventory: isNaN(inventory) ? 0 : inventory,
        });
      }
    } else {
      variants.push({ optionName: trimmed, price: defaultPrice, inventory: 0 });
    }
  }

  return variants;
}

/**
 * Validates all rows in a CSV string up front before saving.
 * Normalizes headers, validates fields per row, and returns structured errors if any row is invalid.
 */
export function parseAndValidateProductsCsv(
  csvText: string,
): CsvParseAndValidateResult {
  const rows = parseCsv(csvText);

  // Filter out completely empty trailing or blank lines
  const nonEmptyRows = rows.filter((r) =>
    r.some((cell) => cell.trim().length > 0),
  );

  if (nonEmptyRows.length === 0) {
    return {
      validProducts: [],
      errors: [{ rowNumber: 1, messages: ["CSV file is empty."] }],
      totalRows: 0,
    };
  }

  const headers = nonEmptyRows[0];
  const titleIdx = resolveHeaderIndex(headers, "title");
  const priceIdx = resolveHeaderIndex(headers, "price");
  const statusIdx = resolveHeaderIndex(headers, "status");
  const collectionIdx = resolveHeaderIndex(headers, "collectionTitle");
  const tagsIdx = resolveHeaderIndex(headers, "tags");
  const variantsIdx = resolveHeaderIndex(headers, "variants");
  const descIdx = resolveHeaderIndex(headers, "description");

  const errors: CsvRowValidationError[] = [];
  const validProducts: CsvImportProductInput[] = [];

  if (titleIdx === -1) {
    errors.push({
      rowNumber: 1,
      messages: [
        "Missing required header column: 'Title' (or 'Product Title' / 'Name').",
      ],
    });
  }
  if (priceIdx === -1) {
    errors.push({
      rowNumber: 1,
      messages: [
        "Missing required header column: 'Price' (or 'Unit Price' / 'MSRP').",
      ],
    });
  }

  if (errors.length > 0) {
    return { validProducts: [], errors, totalRows: nonEmptyRows.length - 1 };
  }

  for (let i = 1; i < nonEmptyRows.length; i++) {
    const row = nonEmptyRows[i];
    const rowNumber = i + 1; // 1-based index (header is 1)
    const messages: string[] = [];

    const rawTitle = (row[titleIdx] ?? "").trim();
    if (!rawTitle) {
      messages.push("Title is required and cannot be blank.");
    }

    const rawPrice = (row[priceIdx] ?? "").trim();
    const priceNum = Number(rawPrice);
    if (!rawPrice || isNaN(priceNum) || priceNum < 0) {
      messages.push(
        `Price "${rawPrice}" must be a valid non-negative number (e.g. 19.99).`,
      );
    }

    let status: "DRAFT" | "ACTIVE" = "DRAFT";
    if (statusIdx !== -1) {
      const rawStatus = (row[statusIdx] ?? "").trim().toUpperCase();
      if (!rawStatus || rawStatus === "DRAFT") {
        status = "DRAFT";
      } else if (rawStatus === "ACTIVE") {
        status = "ACTIVE";
      } else {
        messages.push(
          `Status "${row[statusIdx]}" must be either 'Draft' or 'Active'.`,
        );
      }
    }

    const collectionTitle =
      collectionIdx !== -1 ? (row[collectionIdx] ?? "").trim() || null : null;
    const desc = descIdx !== -1 ? (row[descIdx] ?? "").trim() : "";

    const rawTags = tagsIdx !== -1 ? (row[tagsIdx] ?? "").trim() : "";
    const tags = rawTags
      ? rawTags
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const rawVariants =
      variantsIdx !== -1 ? (row[variantsIdx] ?? "").trim() : "";
    const variants = rawVariants
      ? parseVariantString(rawVariants, rawPrice)
      : [];

    if (messages.length > 0) {
      errors.push({
        rowNumber,
        title: rawTitle || undefined,
        messages,
      });
    } else {
      validProducts.push({
        title: rawTitle,
        price: rawPrice,
        status,
        collectionTitle,
        description: desc,
        tags,
        variants,
      });
    }
  }

  return {
    validProducts,
    errors,
    totalRows: nonEmptyRows.length - 1,
  };
}
