// The Dart mark: a dart flying up and to the right.
export function logoSvg({ bg = "#d4f09a", fg = "#6b3cf2", radius = 16 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${radius}" fill="${bg}"/><path d="M19 45 L41 23" stroke="${fg}" stroke-width="7" stroke-linecap="round"/><path d="M31 15 H49 V33 Z" fill="${fg}" stroke="${fg}" stroke-width="3" stroke-linejoin="round"/><path d="M12 42 L19 45 L22 52" fill="none" stroke="${fg}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
