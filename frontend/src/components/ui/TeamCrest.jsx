const SIZES = {
  sm: 'h-7 w-7 rounded-md text-[0.625rem]',
  md: 'h-10 w-10 rounded-lg text-sm',
  lg: 'h-12 w-12 rounded-lg text-sm',
}

/** A team's logo, or its initial when it has none. */
export function TeamCrest({ team, size = 'md' }) {
  const classes = SIZES[size] ?? SIZES.md

  if (team.logo) {
    return (
      <img
        src={team.logo}
        alt=""
        className={`${classes} shrink-0 object-cover`}
        aria-hidden="true"
      />
    )
  }

  return (
    <span
      className={`from-primary to-secondary text-primary-content ${classes} grid shrink-0 place-items-center bg-gradient-to-br font-bold`}
      aria-hidden="true"
    >
      {(team.name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}
