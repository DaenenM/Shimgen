import { BarChart3, Shuffle, Trophy } from '@/components/icons'
import { paths } from '@/routes/paths'

import { ToolCard } from './ToolCard'

// The site's three tools, mirroring the navbar. Used by HomePage.jsx.
export function ToolGrid() {
  return (
    <section className="mt-16">
      <h2 className="rise-in rise-delay-6 text-center text-2xl font-bold tracking-tight">
        What you can do
      </h2>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <ToolCard
          icon={Trophy}
          title="Tournaments"
          body="Find out who's the best. Solo or in teams."
          to={paths.quickStart}
          action="New tournament"
          delay="rise-delay-6"
        />
        <ToolCard
          icon={Shuffle}
          title="Team Generator"
          body="Split everyone into fair, random teams."
          to={paths.teamGenerator}
          action="Make teams"
          delay="rise-delay-7"
        />
        <ToolCard
          icon={BarChart3}
          title="Stats"
          body="Keep score of who wins, night after night."
          to={paths.stats}
          action="Open stats"
          note="Free account"
          delay="rise-delay-8"
        />
      </div>
    </section>
  )
}
