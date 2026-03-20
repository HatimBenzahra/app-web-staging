import { createContext, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

const TabsContext = createContext({ value: '', onValueChange: () => {} })

function Tabs({ value, onValueChange, defaultValue, children, className, ...props }) {
  const [internalValue, setInternalValue] = useState(defaultValue || '')
  const currentValue = value !== undefined ? value : internalValue
  const handleChange = onValueChange || setInternalValue

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleChange }}>
      <div data-slot="tabs" className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ children, className, ...props }) {
  return (
    <div
      data-slot="tabs-list"
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 border-b border-border w-full overflow-x-auto pb-px',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function TabsTrigger({ value, children, className, disabled, ...props }) {
  const ctx = useContext(TabsContext)
  const isActive = ctx.value === value

  return (
    <button
      data-slot="tabs-trigger"
      role="tab"
      type="button"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-all',
        'border-b-2 -mb-px rounded-t-md',
        isActive
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({ value, children, className, ...props }) {
  const ctx = useContext(TabsContext)
  if (ctx.value !== value) return null

  return (
    <div
      data-slot="tabs-content"
      role="tabpanel"
      className={cn('mt-4 animate-fade-in-content', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
