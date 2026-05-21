const EXTERNAL_READER_SOURCES = new Set(["nelomanga"]);

export function isExternalReaderSource(sourceName?: string | null) {
  return EXTERNAL_READER_SOURCES.has(sourceName?.trim().toLowerCase() ?? "");
}
