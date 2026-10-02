import { Crown, Radio, Save, Swords, UserPlus, Users } from '@/components/icons'

import { ExtraItem } from './ExtraItem'

// The smaller features people discover mid-tournament, listed so they are
// known up front. Used by HomePage.jsx.
export function ExtrasList() {
  return (
    <section className="glass-panel rise-in rise-delay-8 mt-16 p-6 sm:p-8">
      <h2 className="text-xl font-bold tracking-tight">Also built in</h2>

      <ul className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <ExtraItem icon={Radio} title="Live link" body="Friends watch the scores update live." />
        <ExtraItem
          icon={Crown}
          title="Captain drafts"
          body="Captains take turns picking their team."
        />
        <ExtraItem
          icon={Swords}
          title="Best-of series"
          body="Best of 3, 5 or 7 for the big games."
        />
        <ExtraItem icon={UserPlus} title="Co-hosts" body="Let a friend help keep score." />
        <ExtraItem
          icon={Users}
          title="Saved players"
          body="Save your crew so you never retype names."
        />
        <ExtraItem
          icon={Save}
          title="Saved teams"
          body="Keep your best teams and reuse them anytime."
        />
      </ul>
    </section>
  )
}
