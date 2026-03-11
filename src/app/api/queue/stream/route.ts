import { queueEvents } from "@/lib/queue-events";
import { fetchFullQueue } from "@/lib/queue-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  let cleanupFn: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const onUpdate = async () => {
        try {
          const patients = await fetchFullQueue();
          const payload = `event: queue_updated\ndata: ${JSON.stringify({ patients })}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Client may have disconnected
        }
      };

      queueEvents.on("update", onUpdate);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(":keepalive\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      cleanupFn = () => {
        queueEvents.off("update", onUpdate);
        clearInterval(heartbeat);
      };

      onUpdate();
    },
    cancel() {
      cleanupFn?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
