export interface ThemeColors {
  "bg-primary": string;
  "bg-secondary": string;
  "bg-tertiary": string;
  "bg-panel": string;
  "bg-hover": string;
  "bg-selected": string;
  "text-primary": string;
  "text-secondary": string;
  "text-muted": string;
  accent: string;
  "accent-dim": string;
  "accent-glow": string;
  tool: string;
  green: string;
  yellow: string;
  red: string;
  border: string;
  divider: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}

export const themes: Theme[] = [
  {
    id: "material-oceanic",
    name: "Material Oceanic",
    colors: {
      "bg-primary": "#263238",
      "bg-secondary": "#2E3C43",
      "bg-tertiary": "#32424A",
      "bg-panel": "#222D32",
      "bg-hover": "#37474F",
      "bg-selected": "#37474F",
      "text-primary": "#B0BEC5",
      "text-secondary": "#78909C",
      "text-muted": "#607D8B",
      accent: "#009688",
      "accent-dim": "#00796B",
      "accent-glow": "#00968812",
      tool: "#89ddff",
      green: "#c3e88d",
      yellow: "#ffcb6b",
      red: "#f07178",
      border: "#37474F",
      divider: "#2E3C43",
    },
  },
  {
    id: "material-darker",
    name: "Material Darker",
    colors: {
      "bg-primary": "#212121",
      "bg-secondary": "#292929",
      "bg-tertiary": "#303030",
      "bg-panel": "#1A1A1A",
      "bg-hover": "#3C3C3C",
      "bg-selected": "#3C3C3C",
      "text-primary": "#EEFFFF",
      "text-secondary": "#B0BEC5",
      "text-muted": "#616161",
      accent: "#FF9800",
      "accent-dim": "#CC7A00",
      "accent-glow": "#FF980012",
      tool: "#89ddff",
      green: "#c3e88d",
      yellow: "#ffcb6b",
      red: "#f07178",
      border: "#3C3C3C",
      divider: "#292929",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    colors: {
      "bg-primary": "#282a36",
      "bg-secondary": "#21222c",
      "bg-tertiary": "#44475a",
      "bg-panel": "#1e1f29",
      "bg-hover": "#44475a",
      "bg-selected": "#44475a",
      "text-primary": "#f8f8f2",
      "text-secondary": "#6272a4",
      "text-muted": "#6272a4",
      accent: "#bd93f9",
      "accent-dim": "#9771c7",
      "accent-glow": "#bd93f912",
      tool: "#8be9fd",
      green: "#50fa7b",
      yellow: "#f1fa8c",
      red: "#ff5555",
      border: "#44475a",
      divider: "#21222c",
    },
  },
  {
    id: "one-dark",
    name: "One Dark",
    colors: {
      "bg-primary": "#282c34",
      "bg-secondary": "#21252b",
      "bg-tertiary": "#2c313c",
      "bg-panel": "#1e2127",
      "bg-hover": "#3e4452",
      "bg-selected": "#3e4452",
      "text-primary": "#abb2bf",
      "text-secondary": "#5c6370",
      "text-muted": "#4b5263",
      accent: "#61afef",
      "accent-dim": "#4d8cbf",
      "accent-glow": "#61afef12",
      tool: "#56b6c2",
      green: "#98c379",
      yellow: "#d19a66",
      red: "#e06c75",
      border: "#3e4452",
      divider: "#21252b",
    },
  },
  {
    id: "night-owl",
    name: "Night Owl",
    colors: {
      "bg-primary": "#011627",
      "bg-secondary": "#001122",
      "bg-tertiary": "#0b2942",
      "bg-panel": "#000c1d",
      "bg-hover": "#1d3b53",
      "bg-selected": "#1d3b53",
      "text-primary": "#d6deeb",
      "text-secondary": "#5f7e97",
      "text-muted": "#4f6d87",
      accent: "#82aaff",
      "accent-dim": "#6888cc",
      "accent-glow": "#82aaff12",
      tool: "#7fdbca",
      green: "#22da6e",
      yellow: "#addb67",
      red: "#ef5350",
      border: "#1d3b53",
      divider: "#001122",
    },
  },
  {
    id: "ayu-mirage",
    name: "Ayu Mirage",
    colors: {
      "bg-primary": "#1f2430",
      "bg-secondary": "#1a1e29",
      "bg-tertiary": "#242936",
      "bg-panel": "#171b24",
      "bg-hover": "#33415e",
      "bg-selected": "#33415e",
      "text-primary": "#cbccc6",
      "text-secondary": "#707a8c",
      "text-muted": "#5c6773",
      accent: "#ffcc66",
      "accent-dim": "#cc9f47",
      "accent-glow": "#ffcc6612",
      tool: "#73d0ff",
      green: "#bae67e",
      yellow: "#ffa759",
      red: "#ff3333",
      border: "#33415e",
      divider: "#1a1e29",
    },
  },
];

export const defaultThemeId = "material-oceanic";

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty("--color-bg-primary", c["bg-primary"]);
  root.style.setProperty("--color-bg-secondary", c["bg-secondary"]);
  root.style.setProperty("--color-bg-tertiary", c["bg-tertiary"]);
  root.style.setProperty("--color-bg-panel", c["bg-panel"]);
  root.style.setProperty("--color-bg-hover", c["bg-hover"]);
  root.style.setProperty("--color-bg-selected", c["bg-selected"]);
  root.style.setProperty("--color-text-primary", c["text-primary"]);
  root.style.setProperty("--color-text-secondary", c["text-secondary"]);
  root.style.setProperty("--color-text-muted", c["text-muted"]);
  root.style.setProperty("--color-accent", c.accent);
  root.style.setProperty("--color-accent-dim", c["accent-dim"]);
  root.style.setProperty("--color-accent-glow", c["accent-glow"]);
  root.style.setProperty("--color-tool", c.tool);
  root.style.setProperty("--color-green", c.green);
  root.style.setProperty("--color-yellow", c.yellow);
  root.style.setProperty("--color-red", c.red);
  root.style.setProperty("--color-border", c.border);
  root.style.setProperty("--color-divider", c.divider);
}
