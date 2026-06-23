const { ApprovalRequest, Employee, AuditLog } = require('../models');
const { sendNotification } = require('./notify');

/**
 * Finds all pending ApprovalRequests older than SLA_HOURS and escalates them to HR/Admin
 */
async function runEscalationJob(SLA_HOURS = 24) {
  const escalated = [];
  const errors = [];

  try {
    const allPending = await ApprovalRequest.find({ status: 'Pending' });
    const cutoff = new Date(Date.now() - SLA_HOURS * 60 * 60 * 1000);

    for (const approval of allPending) {
      try {
        const createdAt = new Date(approval.createdAt);
        if (createdAt > cutoff) continue; // Not yet breached SLA

        // Find HR/Admin for this tenant as escalation target
        const hrAdmins = await Employee.find({ tenantId: approval.tenantId, role: 'HR/Admin' });
        if (!hrAdmins || hrAdmins.length === 0) continue;

        const escalationTarget = hrAdmins[0];

        // Don't re-escalate if already assigned to HR/Admin
        if (approval.approverId === escalationTarget._id) continue;

        // Update approverId to HR/Admin
        await ApprovalRequest.updateOne(
          { _id: approval._id },
          { $set: { approverId: escalationTarget._id } }
        );

        // Audit log
        await AuditLog.create({
          tenantId: approval.tenantId,
          userId: 'SYSTEM',
          userEmail: 'system@hrms',
          action: 'APPROVAL_ESCALATED',
          ipAddress: 'SYSTEM',
          details: {
            approvalId: approval._id,
            requestType: approval.requestType,
            escalatedTo: escalationTarget._id,
            reason: `SLA of ${SLA_HOURS}h breached`
          }
        });

        // Notify the escalation target
        await sendNotification(
          approval.tenantId,
          escalationTarget._id,
          'Approval Escalated — Action Required',
          `An approval request (${approval.requestType}) has been escalated to you due to SLA breach (${SLA_HOURS}h). Please review and act immediately.`,
          'ACTION_REQUIRED',
          escalationTarget.email
        );

        escalated.push({ approvalId: approval._id, escalatedTo: escalationTarget._id });
      } catch (innerErr) {
        errors.push({ approvalId: approval._id, error: innerErr.message });
      }
    }
  } catch (err) {
    console.error('Escalation job error:', err);
    errors.push({ error: err.message });
  }

  return { escalated, errors };
}

module.exports = { runEscalationJob };
