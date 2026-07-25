const cron = require("node-cron");
const { query } = require("../db");
const { sendZohoMail, generateEmailTemplate } = require("../controllers/emailController");
const logger = require("../logger");

cron.schedule("*/1 * * * *", async () => {
  logger.info("🕒 Email campaign worker running...");

  try {
    const { rows: campaigns } = await query(
      `SELECT id, type, subject, body, recipients, batch_size, interval_minutes, current_batch, total_recipients, sent_count, failed_count
       FROM email_campaigns
       WHERE status = 'scheduled' AND next_run_at <= NOW()
       ORDER BY created_at ASC`
    );

    for (const campaign of campaigns) {
      const recipients = Array.isArray(campaign.recipients) ? campaign.recipients : [];
      const batchSize = Number(campaign.batch_size) || 10;
      const startIndex = Number(campaign.current_batch || 0) * batchSize;
      const batchRecipients = recipients.slice(startIndex, startIndex + batchSize);

      if (!batchRecipients.length) {
        await query(
          `UPDATE email_campaigns
           SET status = 'completed', next_run_at = NULL
           WHERE id = $1`,
          [campaign.id]
        );
        continue;
      }

      logger.info(`Sending email campaign #${campaign.id} batch ${Number(campaign.current_batch || 0) + 1} to ${batchRecipients.length} recipients`);

      const html = generateEmailTemplate(campaign.subject, campaign.body);
      const results = await Promise.allSettled(
        batchRecipients.map((recipient) => sendZohoMail(recipient, campaign.subject, html))
      );

      const failureAddresses = results
        .map((result, index) => (result.status === "rejected" ? batchRecipients[index] : null))
        .filter(Boolean);

      const succeededCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = failureAddresses.length;
      const nextBatch = Number(campaign.current_batch || 0) + 1;
      const totalSent = Number(campaign.sent_count || 0) + succeededCount;
      const totalFailed = Number(campaign.failed_count || 0) + failedCount;
      const hasMore = startIndex + batchSize < recipients.length;
      const nextRunAt = hasMore ? `NOW() + INTERVAL '${Number(campaign.interval_minutes || 5)} minutes'` : null;
      const status = hasMore ? 'scheduled' : 'completed';
      const lastError = failureAddresses.length ? `Failed recipients: ${failureAddresses.join(', ')}` : null;

      await query(
        `UPDATE email_campaigns
         SET current_batch = $1,
             sent_count = $2,
             failed_count = $3,
             status = $4,
             next_run_at = ${nextRunAt || 'NULL'},
             last_error = $5
         WHERE id = $6`,
        [nextBatch, totalSent, totalFailed, status, lastError, campaign.id]
      );

      logger.info(`Campaign #${campaign.id} batch complete: ${succeededCount} sent, ${failedCount} failed.`);
    }
  } catch (err) {
    logger.error("❌ Email campaign worker failed:", err);
  }
});
