import { Link } from 'react-router-dom'

import { paths } from '@/routes/paths'

// Log in / sign up buttons in Navbar.jsx, shown when signed out.
export function SignedOutActions() {
  return (
    <>
      <Link
        to={paths.login}
        className="text-base-content/75 hover:text-base-content hidden px-3.5 py-2 text-[0.9375rem] font-semibold transition-colors duration-200 sm:block"
      >
        Log in
      </Link>

      <Link
        to={paths.register}
        className="bg-primary text-primary-content hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 rounded-xl px-4.5 py-2 text-[0.9375rem] font-semibold shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
      >
        Sign up
      </Link>
    </>
  )
}
