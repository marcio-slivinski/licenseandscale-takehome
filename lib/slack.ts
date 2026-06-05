/**
 * Slack incoming webhook — the P0 external integration.
 *
 * Fires on proposal approval. In production this would be replaced (or augmented) with a GHL API
 * push that updates the opportunity stage + uploads the PDF. Slack is chosen for P0 because:
 *  - Zero auth burden (just a webhook URL).
 *  - Fast iteration during dev.
 *  - Demoable end-to-end without sandbox credentials.
 */

export type SlackNotification = {
  proposalId: string;
  leadName: string;
  total: number;
  pdfUrl: string | null;
  flagCount: number;
};

export async function notifySlack(payload: SlackNotification): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    // In dev without Slack configured, succeed silently (don't block approvals).
    console.warn("[slack] SLACK_WEBHOOK_URL not set — skipping notification.");
    return { ok: true };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const reviewLink = `${baseUrl}/proposals/${payload.proposalId}/sent`;

  const message = {
    text: `Proposal approved: ${payload.leadName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Proposal approved* — ${payload.leadName}\n*Total:* $${payload.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}\n*Flags resolved:* ${payload.flagCount}`,
        },
      },
      {
        type: "actions",
        elements: [
          ...(payload.pdfUrl
            ? [{
                type: "button",
                text: { type: "plain_text", text: "Open PDF" },
                url: payload.pdfUrl,
              }]
            : []),
          {
            type: "button",
            text: { type: "plain_text", text: "View in app" },
            url: reviewLink,
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Slack ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Slack network error" };
  }
}
