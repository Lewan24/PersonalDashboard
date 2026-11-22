function luminance(hex: string): number {
  const rgb = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
export function accentInk(accent: string, light: boolean): string {
  const background = light ? "#ededf0" : "#2a2a2d";
  const source = [1, 3, 5].map((i) =>
    Number.parseInt(accent.slice(i, i + 2), 16),
  );
  for (let step = 0; step <= 100; step++) {
    const color =
      "#" +
      source
        .map((value) =>
          Math.round(value + (((light ? 0 : 255) - value) * step) / 100)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
    if (contrast(color, background) >= 4.5) return color;
  }
  return light ? "#000000" : "#ffffff";
}
export function textOnAccent(accent: string): string {
  return contrast(accent, "#15241a") >= contrast(accent, "#ffffff")
    ? "#15241a"
    : "#ffffff";
}
