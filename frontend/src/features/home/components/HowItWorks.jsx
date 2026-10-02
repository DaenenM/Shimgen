import { HowItWorksStep } from './HowItWorksStep'

// The three steps from names to a finished tournament. Used by HomePage.jsx.
// Aimed at first-timers: it answers "what would I actually do here?" before
// the tool cards below get into specifics.
export function HowItWorks() {
  return (
    <section className="mt-16">
      <h2 className="rise-in rise-delay-5 text-center text-2xl font-bold tracking-tight">
        How it works
      </h2>

      <ol className="mt-6 grid gap-4 md:grid-cols-3">
        <HowItWorksStep
          number={1}
          title="Add your players"
          body="Type in everyone's names."
          delay="rise-delay-5"
        />
        <HowItWorksStep
          number={2}
          title="Pick how to play"
          body="Not sure? Go with lose once, you're out."
          delay="rise-delay-6"
        />
        <HowItWorksStep
          number={3}
          title="Tap the winners"
          body="Shimgen sets up the next match for you."
          delay="rise-delay-7"
        />
      </ol>
    </section>
  )
}
