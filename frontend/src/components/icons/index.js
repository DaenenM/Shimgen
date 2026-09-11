/**
 * The icons this app uses, imported one module at a time.
 *
 * lucide-react's package entry is a barrel re-exporting 4,132 icons. Naming
 * three of them in an import still drags the whole barrel in, which the dev
 * server then prebundles into a single 1.18 MB, 48,000-line file — the largest
 * thing it serves, parsed before any page showing an icon can paint. Excluding
 * it from prebundling is worse still: the browser then makes ~1,800 module
 * requests instead.
 *
 * Importing each icon from its own module sidesteps both. The production build
 * tree-shakes either way, so this is a development speed fix, not a bundle-size
 * one.
 *
 * Add an icon here when you need it, then import it from '@/components/icons'
 * rather than from 'lucide-react' directly.
 */
export { default as AlertTriangle } from 'lucide-react/dist/esm/icons/alert-triangle.mjs'
export { default as Archive } from 'lucide-react/dist/esm/icons/archive.mjs'
export { default as ArchiveRestore } from 'lucide-react/dist/esm/icons/archive-restore.mjs'
export { default as ArrowDown } from 'lucide-react/dist/esm/icons/arrow-down.mjs'
export { default as ArrowLeft } from 'lucide-react/dist/esm/icons/arrow-left.mjs'
export { default as ArrowUp } from 'lucide-react/dist/esm/icons/arrow-up.mjs'
export { default as BarChart3 } from 'lucide-react/dist/esm/icons/bar-chart-3.mjs'
export { default as Check } from 'lucide-react/dist/esm/icons/check.mjs'
export { default as ChevronDown } from 'lucide-react/dist/esm/icons/chevron-down.mjs'
export { default as ChevronRight } from 'lucide-react/dist/esm/icons/chevron-right.mjs'
export { default as Eye } from 'lucide-react/dist/esm/icons/eye.mjs'
export { default as Gamepad2 } from 'lucide-react/dist/esm/icons/gamepad-2.mjs'
export { default as House } from 'lucide-react/dist/esm/icons/house.mjs'
export { default as Info } from 'lucide-react/dist/esm/icons/info.mjs'
export { default as Link2 } from 'lucide-react/dist/esm/icons/link-2.mjs'
export { default as LogOut } from 'lucide-react/dist/esm/icons/log-out.mjs'
export { default as Menu } from 'lucide-react/dist/esm/icons/menu.mjs'
export { default as Minus } from 'lucide-react/dist/esm/icons/minus.mjs'
export { default as Pencil } from 'lucide-react/dist/esm/icons/pencil.mjs'
export { default as Play } from 'lucide-react/dist/esm/icons/play.mjs'
export { default as Plus } from 'lucide-react/dist/esm/icons/plus.mjs'
export { default as Settings2 } from 'lucide-react/dist/esm/icons/settings-2.mjs'
export { default as Share2 } from 'lucide-react/dist/esm/icons/share-2.mjs'
export { default as Shuffle } from 'lucide-react/dist/esm/icons/shuffle.mjs'
export { default as Star } from 'lucide-react/dist/esm/icons/star.mjs'
export { default as Swords } from 'lucide-react/dist/esm/icons/swords.mjs'
export { default as Table2 } from 'lucide-react/dist/esm/icons/table-2.mjs'
export { default as Trash2 } from 'lucide-react/dist/esm/icons/trash-2.mjs'
export { default as Trophy } from 'lucide-react/dist/esm/icons/trophy.mjs'
export { default as UserPlus } from 'lucide-react/dist/esm/icons/user-plus.mjs'
export { default as Users } from 'lucide-react/dist/esm/icons/users.mjs'
export { default as X } from 'lucide-react/dist/esm/icons/x.mjs'
export { default as Zap } from 'lucide-react/dist/esm/icons/zap.mjs'
