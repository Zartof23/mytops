/**
 * Six faint vertical bands, one per topic, fading out down the page.
 *
 * Purely decorative background for the home page: fixed behind the content,
 * non-interactive, and kept at a low opacity so it reads as texture rather than
 * as an element competing with the search box.
 *
 * Deliberately `z-0` and not a negative z-index. A negative one only stays
 * visible while an ancestor happens to establish a stacking context — which the
 * page transition does *during* its transform animation and stops doing the
 * moment the animation ends, making the bands flash and vanish. At `z-0` the
 * bands paint above the layout's background unconditionally; the page content
 * sits above them on its own `relative z-10` wrapper.
 *
 * The seams between bands are softened with a plain `blur` on this element, not
 * with a `backdrop-blur` overlay. A backdrop filter is a second compositing
 * pass over a snapshot of what sits behind it, so the first painted frame shows
 * the bands raw and full-strength before the blur resolves — visible as a flash
 * of saturated colour on load. The container is inset negatively so the blur's
 * own soft edges fall outside the viewport rather than showing as a pale
 * border.
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
      className="pointer-events-none fixed -inset-32 z-0 flex select-none blur-[60px]"
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
    </div>
  )
}
