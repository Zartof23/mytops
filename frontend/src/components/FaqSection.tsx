import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { BuyMeACoffeeButton } from './BuyMeACoffeeButton'
import { GitHubStarBadge } from './GitHubStarBadge'

/** Scroll target for the "What the heck is this?" button on the home page. */
export const FAQ_ANCHOR_ID = 'faq'

interface FaqBand {
  id: string
  question: string
  answer: ReactNode
}

const FAQ_BANDS: FaqBand[] = [
  {
    id: 'what',
    question: 'What is this?',
    answer: (
      <>
        An AI-powered single place to keep your tops organized across every
        topic — movies, series, books, anime, games, restaurants — and
        everything you still want to do: watch, read, play, eat. Rate what
        you&apos;ve already been through, list what&apos;s next. If it&apos;s
        not in the database, AI goes and finds it, and then it&apos;s in there
        permanently for everyone.
      </>
    )
  },
  {
    id: 'track',
    question: 'What can I track?',
    answer: (
      <>
        Six topics today: movies, series, books, anime, games, restaurants. More
        when someone asks for one convincingly enough.
      </>
    )
  },
  {
    id: 'why',
    question: 'Why does this exist?',
    answer: (
      <>
        I wanted one organized, private list of my favorites across everything,
        and nothing covered all of it — especially the unconventional and indie
        picks. So the database gets built by AI, on demand, as people search. It
        grows because you use it.
      </>
    )
  },
  {
    id: 'privacy',
    question: 'Is my data private?',
    answer: (
      <>
        Your ratings are yours and private by default. I don&apos;t sell anything
        to anyone. Public profiles are planned, opt-in, and not built yet.
      </>
    )
  },
  {
    id: 'free',
    question: 'Is it free?',
    answer: (
      <>
        <p className="mb-4">
          Yes. I pay for the AI tokens. If you want to help, star the repo or buy
          me a coffee. Both work.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <GitHubStarBadge size="default" />
          <BuyMeACoffeeButton />
        </div>
      </>
    )
  }
]

/**
 * The FAQ, as full-width bands the reader discovers while scrolling.
 *
 * Bands alternate left / right so the eye zig-zags down the page. Each fades in
 * once when it enters the viewport, or renders immediately when the visitor
 * prefers reduced motion.
 */
export function FaqSection() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section id={FAQ_ANCHOR_ID} aria-label="Frequently asked questions" className="py-16">
      <div className="flex flex-col gap-16">
        {FAQ_BANDS.map((band, index) => {
          const isLeft = index % 2 === 0

          return (
            <motion.div
              key={band.id}
              data-faq-band={band.id}
              data-align={isLeft ? 'left' : 'right'}
              className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}
              initial={prefersReducedMotion ? false : { opacity: 0, x: isLeft ? -40 : 40 }}
              {...(!prefersReducedMotion && {
                whileInView: { opacity: 1, x: 0 },
                viewport: { once: true, amount: 0.4 },
                transition: { duration: 0.5 }
              })}
            >
              <div
                className={`w-full max-w-xl ${
                  isLeft
                    ? 'border-l-2 border-foreground/20 pl-6'
                    : 'text-right border-r-2 border-foreground/20 pr-6'
                }`}
              >
                <h3 className="mb-3 text-2xl font-bold tracking-tight">{band.question}</h3>
                <div className="text-muted-foreground">{band.answer}</div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
