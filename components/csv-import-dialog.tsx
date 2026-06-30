"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Download, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const inputClass =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export type ImportedPlayer = {
  name: string;
  role: string | null;
  country: string | null;
  base_price: number;
};

const TEMPLATE_CSV = [
  "Name,Role,Country,BasePrice",
  "Virat Kohli,Batter,India,2000000",
  "Pat Cummins,Bowler,Australia,2000000",
  "Rashid Khan,Bowler,Afghanistan,1800000",
].join("\n");

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "players-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// Map a header row to our four fields, case-insensitively by trimmed name.
function pickKey(fields: string[], target: string): string | undefined {
  return fields.find((f) => f.trim().toLowerCase() === target);
}

type Parsed = { valid: ImportedPlayer[]; skipped: number };

function parseRows(rows: Record<string, unknown>[], fields: string[]): Parsed | string {
  const nameKey = pickKey(fields, "name");
  const priceKey = pickKey(fields, "baseprice");
  if (!nameKey || !priceKey) return "CSV must have Name and BasePrice columns";

  const roleKey = pickKey(fields, "role");
  const countryKey = pickKey(fields, "country");

  const valid: ImportedPlayer[] = [];
  let skipped = 0;
  for (const row of rows) {
    const name = String(row[nameKey] ?? "").trim();
    const base_price = Number(String(row[priceKey] ?? "").replace(/,/g, "").trim());
    if (!name || Number.isNaN(base_price) || base_price < 0) {
      skipped++;
      continue;
    }
    const role = roleKey ? String(row[roleKey] ?? "").trim() : "";
    const country = countryKey ? String(row[countryKey] ?? "").trim() : "";
    valid.push({ name, role: role || null, country: country || null, base_price });
  }
  return { valid, skipped };
}

export function CsvImportDialog({
  onImport,
  triggerLabel = "Import from CSV",
}: {
  onImport: (players: ImportedPlayer[]) => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError(null);
    try {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const parsed = parseRows(res.data, res.meta.fields ?? []);
          if (typeof parsed === "string") {
            setError(parsed);
            return;
          }
          setResult(parsed);
        },
        error: () => {
          toast.error("Couldn't read that CSV file");
          setError("Couldn't read that CSV file");
        },
      });
    } catch {
      toast.error("Couldn't read that CSV file");
      setError("Couldn't read that CSV file");
    }
  };

  const validCount = result?.valid.length ?? 0;

  const confirm = () => {
    if (!result || validCount === 0) return;
    onImport(result.valid);
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="gap-2" />}>
        <FileUp className="size-4" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import players from CSV</DialogTitle>
          <DialogDescription>
            Columns: <span className="font-mono">Name</span> (required),{" "}
            <span className="font-mono">Role</span>, <span className="font-mono">Country</span>,{" "}
            <span className="font-mono">BasePrice</span>. BasePrice is a plain number with no currency
            symbols or commas (e.g. <span className="font-mono">2000000</span>).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={downloadTemplate}>
            <Download className="size-4" />
            Download example CSV
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs`}
          />

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {result && !error && (
            <p className="text-sm">
              <span className="font-medium">{validCount} players found</span>
              {result.skipped > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  ({result.skipped} skipped — missing name or invalid price)
                </span>
              )}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={confirm} disabled={validCount === 0}>
            Add {validCount} players
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
