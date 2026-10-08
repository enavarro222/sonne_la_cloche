// The bell, drawn by hand like the cyclist: a wobbly black outline, a yellow
// crayon fill with a few strokes of light and shade. Replaces the emoji, which
// looked glossy and differed from one device to another.

const INK = "#1d1a1a";

export function Bell() {
  return (
    <svg viewBox="0 0 100 112" width="100%" aria-hidden="true">
      <g fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        {/* The loop it hangs from. */}
        <path d="M42 17 C42 6 58 5 58.5 16.5" />
        {/* The clapper, under the rim. */}
        <circle cx="51" cy="96" r="8" fill={INK} />
        {/* The body. */}
        <path
          d="M50 15 C33 15.5 25 29 24 48 C23 66 19 76 9.5 86 C36 92.5 66 92 91 85.5 C81.5 76.5 77.5 66 76.5 48.5 C75.5 29 68 14.5 50 15 Z"
          fill="#ffc93c"
        />
      </g>
      {/* Crayon strokes: light on the left, shade on the right. */}
      <g fill="none" strokeLinecap="round" strokeWidth="3.5">
        <path d="M34 44 L39 31 M31 59 L37 42 M29 72 L34 60" stroke="#fff3b0" />
        <path d="M68 40 L65 52 M71 50 L67 66 M74 64 L70 78 M80 76 L76 84" stroke="#e8951c" />
      </g>
      {/* The rim, drawn over the body. */}
      <path
        d="M8 86 C36 93 66 93 92 85.5"
        fill="none"
        stroke={INK}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}
