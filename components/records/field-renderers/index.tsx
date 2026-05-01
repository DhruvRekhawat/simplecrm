"use client"

import { Check, X, ExternalLink, Phone, Mail, Copy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { FieldType } from "@/lib/schema-detector"

export type RenderContext = "table" | "detail"

const EMPTY = <span className="text-muted-foreground">—</span>

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === ""
}

function copy(v: string) {
  navigator.clipboard.writeText(v).then(
    () => toast.success("Copied"),
    () => toast.error("Copy failed")
  )
}

export function FieldRenderer({
  type,
  value,
  context,
}: {
  type: FieldType
  value: unknown
  context: RenderContext
}) {
  if (isEmpty(value)) return EMPTY

  switch (type) {
    case "string":
      return <StringField value={String(value)} context={context} />
    case "number":
      return <NumberField value={Number(value)} context={context} />
    case "phone":
      return <PhoneField value={String(value)} context={context} />
    case "url":
      return <UrlField value={String(value)} context={context} />
    case "email":
      return <EmailField value={String(value)} context={context} />
    case "array":
      return <ArrayField value={value as unknown[]} context={context} />
    case "boolean":
      return <BooleanField value={!!value} context={context} />
    case "json":
      return <JsonField value={value} context={context} />
    default:
      return <span>{String(value)}</span>
  }
}

function StringField({ value, context }: { value: string; context: RenderContext }) {
  if (context === "table") {
    return (
      <span className="block truncate" title={value}>
        {value}
      </span>
    )
  }
  return <span className="whitespace-pre-wrap break-words">{value}</span>
}

function NumberField({ value, context }: { value: number; context: RenderContext }) {
  const display = Number.isInteger(value) ? value.toString() : value.toFixed(1)
  if (context === "table") {
    return <span className="tabular-nums text-right block">{display}</span>
  }
  return <span className="tabular-nums">{display}</span>
}

function PhoneField({ value, context }: { value: string; context: RenderContext }) {
  if (context === "table") {
    return (
      <a
        href={`tel:${value}`}
        className="text-primary hover:underline truncate block"
        onClick={(e) => e.stopPropagation()}
      >
        {value}
      </a>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <a
        href={`tel:${value}`}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
      >
        <Phone className="size-3.5" /> Call {value}
      </a>
      <button
        onClick={() => copy(value)}
        className="size-8 inline-flex items-center justify-center rounded-md hover:bg-accent"
        aria-label="Copy"
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  )
}

function UrlField({ value, context }: { value: string; context: RenderContext }) {
  let host = value
  try {
    host = new URL(value).hostname
  } catch {
    /* keep raw */
  }
  if (context === "table") {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:underline inline-flex items-center gap-1 truncate"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate">{host}</span>
        <ExternalLink className="size-3 shrink-0" />
      </a>
    )
  }
  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-accent"
    >
      <ExternalLink className="size-3.5" /> Open {host}
    </a>
  )
}

function EmailField({ value, context }: { value: string; context: RenderContext }) {
  if (context === "table") {
    return (
      <a
        href={`mailto:${value}`}
        className="text-primary hover:underline truncate block"
        onClick={(e) => e.stopPropagation()}
      >
        {value}
      </a>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <a
        href={`mailto:${value}`}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-accent"
      >
        <Mail className="size-3.5" /> {value}
      </a>
      <button
        onClick={() => copy(value)}
        className="size-8 inline-flex items-center justify-center rounded-md hover:bg-accent"
        aria-label="Copy"
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  )
}

function ArrayField({ value, context }: { value: unknown[]; context: RenderContext }) {
  if (!Array.isArray(value) || value.length === 0) return EMPTY
  const items = value.map((v) => String(v))
  if (context === "table") {
    const shown = items.slice(0, 2)
    const remaining = items.length - shown.length
    return (
      <div className="flex items-center gap-1 truncate">
        {shown.map((s, i) => (
          <Badge key={i} variant="secondary" className="text-xs">
            {s}
          </Badge>
        ))}
        {remaining > 0 && (
          <span className="text-xs text-muted-foreground">+{remaining}</span>
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((s, i) => (
        <Badge key={i} variant="secondary">
          {s}
        </Badge>
      ))}
    </div>
  )
}

function BooleanField({ value, context }: { value: boolean; context: RenderContext }) {
  if (context === "table") {
    return value ? (
      <Check className="size-4 text-green-500" />
    ) : (
      <X className="size-4 text-red-500" />
    )
  }
  return (
    <Badge variant={value ? "default" : "secondary"}>{value ? "Yes" : "No"}</Badge>
  )
}

function JsonField({ value, context }: { value: unknown; context: RenderContext }) {
  if (context === "table") {
    return <span className="text-xs text-muted-foreground font-mono">{"{...}"}</span>
  }
  return (
    <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto max-h-72">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}
