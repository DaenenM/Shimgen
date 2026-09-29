import { GeneratedTeams } from './GeneratedTeams'

// Generated teams, or a placeholder. Used by TeamGeneratorPage.jsx.
export function TeamResults({ gen }) {
  return gen.result ? (
    <GeneratedTeams
      teams={gen.result.teams}
      teamNames={gen.teamNames}
      nameFor={gen.nameFor}
      onRename={gen.renameTeam}
      onArrange={gen.arrangeTeams}
    />
  ) : (
    <div className="border-base-content/12 text-base-content/40 flex h-full min-h-[16rem] items-center justify-center rounded-[1.25rem] border border-dashed p-8 text-center text-sm">
      Your teams will appear here.
    </div>
  )
}
