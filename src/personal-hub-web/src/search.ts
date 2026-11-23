function normalize(value: string) {
  return value
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("ł", "l");
}

export function makeSearch(value: string) {
  const words = normalize(value).trim().split(/\s+/).filter(Boolean);
  return {
    active: words.length > 0,
    matches(...values: (string | null | undefined)[]) {
      const text = normalize(values.join(" "));
      return words.every((word) => text.includes(word));
    },
  };
}
