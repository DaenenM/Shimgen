export function Footer() {
  return (
    <footer className="footer footer-center bg-base-200 text-base-content/60 mt-auto p-6 text-sm">
      <aside>
        <p>Shimgen — brackets, teams and stats that stick around.</p>
        <p>© {new Date().getFullYear()}</p>
      </aside>
    </footer>
  )
}
