/* Icone a tratto, disegnate per questa app (24px, tratto 1.6). */

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
  </Svg>
);
export const IconSessions = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8 9h8M8 12.5h8M8 16h5" />
  </Svg>
);
export const IconBooks = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4.5h3.5v15H5zM10.5 4.5H14v15h-3.5z" />
    <path d="m15 5.4 3.2-.8 2.9 14.2-3.2.8z" />
  </Svg>
);
export const IconProgress = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 19h16" />
    <path d="m5 15 4.5-4.5 3.5 3L19 7" />
    <path d="M15 7h4v4" />
  </Svg>
);
export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
);
export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M4.5 14.5V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.5" />
  </Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);
export const IconFile = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
    <path d="M14 3.5v5h5M8.5 13h7M8.5 16.5h5" />
  </Svg>
);
export const IconImage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m20 16-5-5-8 8" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconMic = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
  </Svg>
);
export const IconStop = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
  </Svg>
);
export const IconRepeat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12a7.5 7.5 0 0 1 13-5.1L19.5 9" />
    <path d="M19.5 4.5V9H15" />
    <path d="M19.5 12a7.5 7.5 0 0 1-13 5.1L4.5 15" />
    <path d="M4.5 19.5V15H9" />
  </Svg>
);
export const IconSpeaker = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 9.5h3l4-3.5v12l-4-3.5H5z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
);
export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
    <path d="M8 10h8M8 13h5" />
  </Svg>
);
export const IconLaurel = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20c-4.5-1.5-7-5-7-10" />
    <path d="M12 20c4.5-1.5 7-5 7-10" />
    <path d="M5.5 13.5c1.5 0 2.8.5 3.5 1.8M4.8 9.8c1.4.2 2.5.9 3 2.1M5.6 6.4c1.2.5 2 1.4 2.2 2.7" />
    <path d="M18.5 13.5c-1.5 0-2.8.5-3.5 1.8M19.2 9.8c-1.4.2-2.5.9-3 2.1M18.4 6.4c-1.2.5-2 1.4-2.2 2.7" />
  </Svg>
);
export const IconBriefcase = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
    <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" />
  </Svg>
);
export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 7h14M10 7V5h4v2M7 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7" />
  </Svg>
);
export const IconArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const IconKeyboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M7 10h.01M10.5 10h.01M14 10h.01M17 10h.01M8 14h8" />
  </Svg>
);
export const IconVideo = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="m16 10.5 5-3v9l-5-3" />
  </Svg>
);
export const IconWave = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />
  </Svg>
);
export const IconPencil = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Svg>
);
export const IconPrinter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
    <path d="M7 14h10v7H7z" />
  </Svg>
);
