const EXTERNAL_READER_SOURCES = ["comikey", "mangadex", "manganato", "mangaplus", "nelomanga"];

export function isExternalReaderSource(sourceName?: string | null) {
  const normalizedName = sourceName?.trim().toLowerCase() ?? "";
  return EXTERNAL_READER_SOURCES.some((source) => normalizedName.includes(source));
}
