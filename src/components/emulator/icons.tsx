/** Лінійні іконки для кнопок емулятора. Декоративні: у кнопці завжди є текст. */
import type { ComponentChildren } from 'preact';

function Svg({ children }: { children: ComponentChildren }) {
  return (
    <svg
      class="icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconStep = () => (
  <Svg>
    <path d="M5 5l9 7-9 7z" />
    <path d="M18 5v14" />
  </Svg>
);

export const IconPlay = () => (
  <Svg>
    <path d="M7 4l13 8-13 8z" />
  </Svg>
);

export const IconPause = () => (
  <Svg>
    <path d="M8 5v14" />
    <path d="M16 5v14" />
  </Svg>
);

export const IconReset = () => (
  <Svg>
    <path d="M4 5v5h5" />
    <path d="M5.5 15a7.5 7.5 0 1 0 1.8-7.8L4 10" />
  </Svg>
);

export const IconSave = () => (
  <Svg>
    <path d="M12 4v11" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 20h14" />
  </Svg>
);

export const IconOpen = () => (
  <Svg>
    <path d="M12 16V5" />
    <path d="M7 9l5-5 5 5" />
    <path d="M5 20h14" />
  </Svg>
);

export const IconShare = () => (
  <Svg>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);

export const IconLeft = () => (
  <Svg>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);

export const IconRight = () => (
  <Svg>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const IconNumbers = () => (
  <Svg>
    <path d="M4 6h2v5" />
    <path d="M4 11h4" />
    <path d="M4 15h3.5a1 1 0 0 1 0 2H5a1 1 0 0 0 0 2h3" />
    <path d="M12 7h8" />
    <path d="M12 12h8" />
    <path d="M12 17h8" />
  </Svg>
);
