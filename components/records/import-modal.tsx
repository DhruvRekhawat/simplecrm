"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Upload, FileJson, X, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { mutate as globalMutate } from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { SchemaField, FieldType } from "@/lib/schema-detector"

type Step = "drop" | "preview" | "dedup" | "running" | "done"

const TYPES: FieldType[] = [
  "string",
  "number",
  "boolean",
  "phone",
  "url",
  "email",
  "array",
  "json",
]

type DetectionPayload = {
  detected: { schema: SchemaField[]; titleField: string; dedupField: string }
  hasExistingRecords: boolean
  preview: Record<string, unknown>[]
}

export function ImportModal({
  open,
  onOpenChange,
  pageId,
  hasExistingRecords,
  onComplete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  pageId: string
  hasExistingRecords: boolean
  onComplete: () => void
}) {
  const [step, setStep] = useState<Step>("drop")
  const [records, setRecords] = useState<Record<string, unknown>[]>([])
  const [fileName, setFileName] = useState<string>("")
  const [parsing, setParsing] = useState(false)
  const [detection, setDetection] = useState<DetectionPayload | null>(null)
  const [schema, setSchema] = useState<SchemaField[]>([])
  const [titleField, setTitleField] = useState("")
  const [dedupField, setDedupField] = useState("")
  const [mode, setMode] = useState<"new_only" | "upsert">("new_only")
  const [dedupSummary, setDedupSummary] = useState<{ matches: number; news: number } | null>(null)
  const [progress, setProgress] = useState(0)
  const [summary, setSummary] = useState<{
    inserted: number
    updated: number
    skipped: number
    newColumns: string[]
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep("drop")
    setRecords([])
    setFileName("")
    setDetection(null)
    setSchema([])
    setTitleField("")
    setDedupField("")
    setMode("new_only")
    setDedupSummary(null)
    setProgress(0)
    setSummary(null)
    setParsing(false)
  }

  function handleClose(v: boolean) {
    if (!v) reset()
    onOpenChange(v)
  }

  const onFile = useCallback(
    async (file: File) => {
      setParsing(true)
      setFileName(file.name)
      try {
        const text = await file.text()
        let parsed: unknown
        try {
          parsed = JSON.parse(text)
        } catch {
          toast.error("Could not parse file. Ensure it's valid JSON.")
          setParsing(false)
          return
        }
        let arr: unknown[]
        if (Array.isArray(parsed)) arr = parsed
        else if (parsed && typeof parsed === "object") arr = [parsed]
        else {
          toast.error("File must contain an object or array of objects.")
          setParsing(false)
          return
        }
        if (arr.length === 0) {
          toast.error("File contains no records.")
          setParsing(false)
          return
        }
        const recs = arr.filter(
          (r): r is Record<string, unknown> =>
            typeof r === "object" && r !== null && !Array.isArray(r)
        )
        if (recs.length === 0) {
          toast.error("File must contain plain objects.")
          setParsing(false)
          return
        }
        setRecords(recs)

        // Send first 100 to detect-schema
        const sample = recs.slice(0, 100)
        const res = await fetch(`/api/pages/${pageId}/detect-schema`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: sample }),
        })
        if (!res.ok) {
          toast.error("Schema detection failed")
          setParsing(false)
          return
        }
        const data: DetectionPayload = await res.json()
        setDetection(data)
        setSchema(data.detected.schema)
        setTitleField(data.detected.titleField)
        setDedupField(data.detected.dedupField)
        setStep("preview")
      } finally {
        setParsing(false)
      }
    },
    [pageId]
  )

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  async function checkDedup() {
    // Client-side dedup check using detection sample for speed
    if (!dedupField || !hasExistingRecords) {
      runImport()
      return
    }
    // Fetch existing dedup values for compare
    const res = await fetch(
      `/api/pages/${pageId}/records?limit=10000&fields=${encodeURIComponent(dedupField)}`,
      { method: "GET" }
    ).catch(() => null)

    // If records API doesn't exist yet, just send to import server-side dedup
    if (!res || !res.ok) {
      setStep("dedup")
      setDedupSummary(null)
      return
    }
    setStep("dedup")
  }

  async function runImport() {
    setStep("running")
    setProgress(10)
    try {
      const res = await fetch(`/api/pages/${pageId}/records/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records,
          schema,
          titleField,
          dedupField,
          mode,
        }),
      })
      setProgress(80)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error || "Import failed")
        setStep("preview")
        return
      }
      const data = await res.json()
      setSummary(data)
      setProgress(100)
      setStep("done")
      onComplete()
      globalMutate("/api/pages")
      globalMutate("/api/pages?starred=1")
    } catch {
      toast.error("Import failed")
      setStep("preview")
    }
  }

  const stringFields = useMemo(
    () => schema.filter((f) => f.type === "string" || f.type === "phone" || f.type === "email"),
    [schema]
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import JSON</DialogTitle>
          <DialogDescription>
            {step === "drop" && "Drop a JSON file to auto-detect its schema."}
            {step === "preview" && "Review detected columns and confirm settings."}
            {step === "dedup" && "Choose how to handle matching records."}
            {step === "running" && "Importing records..."}
            {step === "done" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {step === "drop" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="border-2 border-dashed rounded-lg p-10 text-center hover:bg-accent/30 transition cursor-pointer"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
              }}
            />
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Parsing {fileName}...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="size-12 rounded-full bg-accent flex items-center justify-center">
                  <Upload className="size-6 text-muted-foreground" />
                </div>
                <p className="font-medium">Drop a JSON file here</p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </div>
            )}
          </div>
        )}

        {step === "preview" && detection && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileJson className="size-4" />
              <span className="font-medium">{fileName}</span>
              <Badge variant="secondary">{records.length} records</Badge>
              <Badge variant="secondary">{schema.length} columns</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Title field</label>
                <Select value={titleField || "__none"} onValueChange={(v) => setTitleField(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {stringFields.map((f) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dedup field</label>
                <Select value={dedupField || "__none"} onValueChange={(v) => setDedupField(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None (no dedup)</SelectItem>
                    {schema.map((f) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-md max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left">
                    <th className="px-2 py-1 w-8"></th>
                    <th className="px-2 py-1">Key</th>
                    <th className="px-2 py-1">Label</th>
                    <th className="px-2 py-1 w-32">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {schema.map((f, i) => (
                    <tr key={f.key} className="border-t">
                      <td className="px-2 py-1">
                        <Checkbox
                          checked={f.visible}
                          onCheckedChange={(v) => {
                            const next = [...schema]
                            next[i] = { ...f, visible: !!v }
                            setSchema(next)
                          }}
                        />
                      </td>
                      <td className="px-2 py-1 font-mono text-xs text-muted-foreground">{f.key}</td>
                      <td className="px-2 py-1">
                        <Input
                          value={f.label}
                          onChange={(e) => {
                            const next = [...schema]
                            next[i] = { ...f, label: e.target.value }
                            setSchema(next)
                          }}
                          className="h-7"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Select
                          value={f.type}
                          onValueChange={(v) => {
                            const next = [...schema]
                            next[i] = { ...f, type: v as FieldType }
                            setSchema(next)
                          }}
                        >
                          <SelectTrigger className="h-7"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === "dedup" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The page already has records. Server-side dedup will run on the{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{dedupField}</code>{" "}
              field. Choose what to do with matches:
            </p>
            <div className="space-y-2">
              <button
                onClick={() => setMode("new_only")}
                className={cn(
                  "w-full text-left border rounded-md p-3 hover:bg-accent/30",
                  mode === "new_only" && "border-foreground bg-accent/40"
                )}
              >
                <div className="font-medium text-sm">Import new only</div>
                <div className="text-xs text-muted-foreground">
                  Skip records that already exist. Existing data is unchanged.
                </div>
              </button>
              <button
                onClick={() => setMode("upsert")}
                className={cn(
                  "w-full text-left border rounded-md p-3 hover:bg-accent/30",
                  mode === "upsert" && "border-foreground bg-accent/40"
                )}
              >
                <div className="font-medium text-sm">Import & update existing</div>
                <div className="text-xs text-muted-foreground">
                  Insert new records and overwrite data of matching ones.
                </div>
              </button>
            </div>
          </div>
        )}

        {step === "running" && (
          <div className="py-8 space-y-3">
            <Progress value={progress} />
            <p className="text-sm text-center text-muted-foreground">
              Importing {records.length} records...
            </p>
          </div>
        )}

        {step === "done" && summary && (
          <div className="py-4 space-y-3">
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="size-10 text-green-500" />
              <p className="font-medium">Import complete</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="border rounded-md p-3">
                <div className="text-2xl font-semibold">{summary.inserted}</div>
                <div className="text-xs text-muted-foreground">Inserted</div>
              </div>
              <div className="border rounded-md p-3">
                <div className="text-2xl font-semibold">{summary.updated}</div>
                <div className="text-xs text-muted-foreground">Updated</div>
              </div>
              <div className="border rounded-md p-3">
                <div className="text-2xl font-semibold">{summary.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
            </div>
            {summary.newColumns.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {summary.newColumns.length} new column
                {summary.newColumns.length === 1 ? "" : "s"} added (hidden by default):{" "}
                {summary.newColumns.join(", ")}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "drop" && (
            <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("drop")}>Back</Button>
              <Button
                onClick={() => {
                  if (hasExistingRecords && dedupField) setStep("dedup")
                  else runImport()
                }}
              >
                {hasExistingRecords && dedupField ? "Continue" : `Import ${records.length} records`}
              </Button>
            </>
          )}
          {step === "dedup" && (
            <>
              <Button variant="outline" onClick={() => setStep("preview")}>Back</Button>
              <Button onClick={runImport}>Import {records.length} records</Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => handleClose(false)}>
              <X className="size-4" /> Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
