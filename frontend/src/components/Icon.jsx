// A small, consistent line-icon set (24px grid, 1.8 stroke), in the spirit of SF Symbols.
const PATHS = {
  compose: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a2 2 0 0 0 3.4 0",
  up: "M12 19V5m-6 6 6-6 6 6",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  plus: "M12 5v14M5 12h14",
  chevron: "m9 6 6 6-6 6",
  back: "m15 6-6 6 6 6",
  close: "M6 6l12 12M18 6 6 18",
  trash: "M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13",
  pause: "M8 5v14M16 5v14",
  play: "M7 5v14l12-7Z",
  refresh: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
  edit: "M4 20h4L19 9l-4-4L4 16Z",
  external: "M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  feedback: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12ZM8.5 10.5h7m-7 3.5h4",
  shield: "M12 3 5 6v6c0 4.4 3 8 7 9 4-1 7-4.6 7-9V6Z",
  sidebar: "M4 5h16v14H4Zm5 0v14",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  pin: "M9 4h6l-1 6 4 3v2h-5v5l-1 1-1-1v-5H6v-2l4-3Z",
  archive: "M4 5h16v4H4Zm1 4v10h14V9M10 13h4",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
  copy: "M8 8h11v11H8ZM5 16V5h11",
  search: "m20 20-4.35-4.35M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z",
  restore: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  sun: "M12 3v1.5m0 15V21M3 12h1.5m15 0H21M5.6 5.6l1.1 1.1m10.6 10.6 1.1 1.1m0-12.8-1.1 1.1M6.7 17.3l-1.1 1.1M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  moon: "M20 14.3A8 8 0 0 1 9.7 4a8 8 0 1 0 10.3 10.3Z",
  chart: "M5 20v-8m7 8V5m7 15v-5M3 20h18",
  check: "M5 12l5 5L20 7",
  camera: "M4 8h3l2-3h6l2 3h3v11H4Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
};

export default function Icon({ name, size = 20, title }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d={PATHS[name]} strokeWidth={name === "more" ? 3 : undefined} />
    </svg>
  );
}
