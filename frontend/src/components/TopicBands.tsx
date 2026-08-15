/**
 * Six faint vertical bands, one per topic, fading out down the page.
 *
 * Purely decorative background for the home page: fixed behind the content,
 * non-interactive, and kept at a low opacity so it reads as texture rather than
 * as an element competing with the search box.
 */

/** One hue per topic, in the order the topics are listed across the product. */
const BAND_COLORS = [
  '#6366f1', // movies
  '#a855f7', // series
  '#f59e0b', // books
  '#ec4899', // anime
  '#10b981', // games
  '#f97316' // restaurants
]

export function TopicBands() {
  return (
    <div
      aria-hidden="true"
      data-testid="topic-bands"
      className="pointer-events-none fixed inset-0 -z-10 flex select-none"
    >
      {BAND_COLORS.map((color, index) => (
        <div
          key={color}
          className="h-full flex-1 opacity-[0.07] dark:opacity-[0.13]"
          style={{
            // Colour is strongest at the very top and gone by mid-page, so the
            // content below the fold sits on the plain background.
            backgroundImage: `linear-gradient(to bottom, ${color} 0%, ${color}00 55%)`,
            // Stagger the falloff so the band edges never line up as a hard rule.
            maskImage: `linear-gradient(to bottom, black 0%, transparent ${70 + (index % 3) * 8}%)`,
            WebkitMaskImage: `linear-gradient(to bottom, black 0%, transparent ${70 + (index % 3) * 8}%)`
          }}
        />
      ))}
      {/* Soften the vertical seams between bands. */}
      <div className="absolute inset-0 backdrop-blur-[60px]" />
    </div>
  )
}
