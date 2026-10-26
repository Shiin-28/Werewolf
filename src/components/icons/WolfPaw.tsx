/**
 * Wolf track: compact oval print, front toes bunched forward, hooked talons, and a dripping heel pad.
 * Drawn on a 64×64 grid in currentColor so it takes the text color like a lucide icon.
 */
export function WolfPaw({ className, ...rest }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" className={className} {...rest}>
      {/* toes */}
      <ellipse cx="27.5" cy="20" rx="4.6" ry="7.2" transform="rotate(-6 27.5 20)" />
      <ellipse cx="36.5" cy="20" rx="4.6" ry="7.2" transform="rotate(6 36.5 20)" />
      <ellipse cx="18" cy="31" rx="4.2" ry="6.2" transform="rotate(-22 18 31)" />
      <ellipse cx="46" cy="31" rx="4.2" ry="6.2" transform="rotate(22 46 31)" />
      {/* talons */}
      <path d="M25.4 11.8 C25 8.6 25 6 26.2 2.8 C26.6 6 27.6 8.8 28 11.6 C27.1 11.2 26.3 11.3 25.4 11.8 Z" />
      <path d="M38.6 11.8 C39 8.6 39 6 37.8 2.8 C37.4 6 36.4 8.8 36 11.6 C36.9 11.2 37.7 11.3 38.6 11.8 Z" />
      <path d="M14.2 24.8 C13.4 22 12.6 19.6 12.3 16.9 C13.9 19 15.4 21.2 16.4 23.9 C15.6 24 14.9 24.3 14.2 24.8 Z" />
      <path d="M49.8 24.8 C50.6 22 51.4 19.6 51.7 16.9 C50.1 19 48.6 21.2 47.6 23.9 C48.4 24 49.1 24.3 49.8 24.8 Z" />
      {/* heel pad */}
      <path d="M32 33.5 C37.5 33.5 42.8 38 43 44 C43.2 49.5 40.6 52.8 37.6 51.8 C35.6 51.2 34 52 32 53.4 C30 52 28.4 51.2 26.4 51.8 C23.4 52.8 20.8 49.5 21 44 C21.2 38 26.5 33.5 32 33.5 Z" />
      {/* blood drips */}
      <path d="M30.5 52.6 V58.8 A1.5 1.5 0 0 0 33.5 58.8 V52.6 Z" />
      <path d="M37.2 51.6 V55.4 A1.2 1.2 0 0 0 39.6 55.4 V51.2 Z" />
      <path d="M23.6 51.8 V54 A0.9 0.9 0 0 0 25.4 54 V52.2 Z" />
    </svg>
  );
}
