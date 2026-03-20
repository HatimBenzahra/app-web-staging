import * as React from 'react'
import { X, Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

/**
 * MultiSelect Component
 *
 * @param {Object} props
 * @param {Array} props.options - Array d'options {value: string, label: string, group?: string, disabled?: boolean}
 * @param {Array} props.selected - Array des valeurs sélectionnées
 * @param {Function} props.onChange - Callback pour les changements
 * @param {string} props.placeholder - Texte du placeholder
 * @param {string} props.emptyText - Texte quand aucun résultat
 * @param {string} props.className - Classes CSS additionnelles
 * @param {string} props.id - ID de l'élément
 * @param {Function} props.getOptionDisabled - Fonction pour déterminer si une option est désactivée
 */
export function MultiSelect({
  options = [],
  selected = [],
  onChange,
  placeholder = 'Sélectionnez...',
  emptyText = 'Aucun résultat trouvé.',
  className,
  disabled = false,
  id,
  getOptionDisabled,
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const dropdownRef = React.useRef(null)
  const buttonRef = React.useRef(null)

  // Fermer le dropdown si on clique en dehors
  React.useEffect(() => {
    const handleClickOutside = event => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const handleSelect = value => {
    const newSelected = selected.includes(value)
      ? selected.filter(item => item !== value)
      : [...selected, value]
    onChange?.(newSelected)
  }

  const handleRemove = (value, e) => {
    e.stopPropagation()
    onChange?.(selected.filter(item => item !== value))
  }

  const selectedOptions = options.filter(option => selected.includes(option.value))

  // Filtrer les options selon la recherche
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  )

  // Grouper les options par groupe si disponible
  const groupedOptions = filteredOptions.reduce((acc, option) => {
    const group = option.group || 'default'
    if (!acc[group]) acc[group] = []
    acc[group].push(option)
    return acc
  }, {})

  return (
    <div className="relative w-full">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          'border-input data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-auto min-h-[2.25rem]',
          !selected.length && 'text-muted-foreground',
          className
        )}
      >
        <div className="flex flex-wrap gap-1 flex-1 items-center">
          {selected.length > 0 ? (
            selectedOptions.map(option => (
              <Badge
                key={option.value}
                variant="secondary"
                className="flex items-center gap-1 px-2 py-0.5"
              >
                {option.label}
                <button
                  type="button"
                  className="ml-1 rounded-full outline-none ring-offset-background hover:bg-muted"
                  onMouseDown={e => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={e => handleRemove(option.value, e)}
                  disabled={disabled}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            ))
          ) : (
            <span>{placeholder}</span>
          )}
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-[150] mt-2 w-full max-h-80 overflow-hidden rounded-md border bg-popover shadow-md animate-in fade-in-0 zoom-in-95"
        >
          <div className="p-2 border-b">
            <Input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
            ) : (
              Object.entries(groupedOptions).map(([group, groupOptions]) => (
                <div key={group}>
                  {group !== 'default' && (
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {group}
                    </div>
                  )}
                  {groupOptions.map(option => {
                    const isSelected = selected.includes(option.value)
                    const isDisabled = getOptionDisabled ? getOptionDisabled(option) : option.disabled
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => !isDisabled && handleSelect(option.value)}
                        disabled={isDisabled}
                        className={cn(
                          'relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors',
                          isSelected && 'bg-accent/50',
                          isDisabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'opacity-50 [&_svg]:invisible'
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </div>
                        <span className="flex-1 text-left">{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
