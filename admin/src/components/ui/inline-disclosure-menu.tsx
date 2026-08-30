import * as React from "react"
import { LucideIcon } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu"

export interface InlineDisclosureMenuItem {
  key: string
  label: string
  icon?: LucideIcon | React.FC<any>
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
}

export interface InlineDisclosureMenuProps {
  trigger: React.ReactNode
  items: InlineDisclosureMenuItem[]
}

export function InlineDisclosureMenu({ trigger, items }: InlineDisclosureMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem 
            key={item.key} 
            onClick={item.onClick}
            disabled={item.disabled}
            className={item.variant === 'danger' ? "text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer" : "cursor-pointer"}
          >
            {item.icon && <item.icon className="mr-2 h-4 w-4" />}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
