"use client";

import { Settings2, Volume2 } from "lucide-react";
import { speakSample, useVoiceSettings } from "@/lib/auctioneer/narrator";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SAMPLE = "Sold! To Mumbai Mavericks, for two crore!";

export function VoiceSettings() {
  const { voices, cfg, update } = useVoiceSettings();

  // English voices first, then the rest.
  const sorted = [...voices].sort((a, b) => {
    const ae = a.lang?.toLowerCase().startsWith("en") ? 0 : 1;
    const be = b.lang?.toLowerCase().startsWith("en") ? 0 : 1;
    return ae - be || a.name.localeCompare(b.name);
  });

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label="Voice settings"
        title="Voice settings"
      >
        <Settings2 className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Auctioneer voice</DialogTitle>
          <DialogDescription>Pick the voice, speed and volume for the spoken commentary.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="voice">Voice</Label>
            <select
              id="voice"
              value={cfg.voiceURI ?? ""}
              onChange={(e) => update({ voiceURI: e.target.value || null })}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">Auto (prefers Indian English)</option>
              {sorted.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            {voices.length === 0 && (
              <p className="text-xs text-muted-foreground">No voices reported by this browser.</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="rate">Speed</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{cfg.rate.toFixed(2)}×</span>
            </div>
            <input
              id="rate"
              type="range"
              min={0.6}
              max={1.4}
              step={0.05}
              value={cfg.rate}
              onChange={(e) => update({ rate: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="volume">Volume</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{Math.round(cfg.volume * 100)}%</span>
            </div>
            <input
              id="volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={cfg.volume}
              onChange={(e) => update({ volume: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={() => speakSample(SAMPLE)}>
            <Volume2 className="size-4" /> Test voice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
