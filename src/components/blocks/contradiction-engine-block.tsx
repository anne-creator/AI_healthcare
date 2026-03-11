"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FadeIn } from "@/components/animations/fade-in";
import { useClinicalReasoning } from "@/hooks/use-clinical-reasoning";

interface ContradictionEngineBlockProps {
  hadmId: number;
}

export function ContradictionEngineBlock({
  hadmId,
}: ContradictionEngineBlockProps) {
  const { streamedText, isLoading, error, reason, stop } =
    useClinicalReasoning(hadmId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AI Clinical Reasoning</CardTitle>
            <CardDescription>
              Live streaming analysis powered by Gemini
            </CardDescription>
          </div>
          <Button
            onClick={isLoading ? stop : reason}
            size="sm"
            variant={isLoading ? "outline" : "default"}
            aria-label={isLoading ? "Stop AI analysis" : "Run AI analysis"}
          >
            {isLoading ? "Stop" : "Run AI Analysis"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive">Error: {error}</p>
        )}

        {(streamedText || isLoading) && (
          <FadeIn>
            <div className="rounded-lg border bg-muted/30 p-4">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                {streamedText}
                {isLoading && (
                  <span className="inline-block h-4 w-1.5 animate-pulse bg-foreground/70" />
                )}
              </pre>
            </div>
          </FadeIn>
        )}

        {!streamedText && !isLoading && !error && (
          <p className="text-sm text-muted-foreground">
            Click &quot;Run AI Analysis&quot; to stream live clinical
            reasoning.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
