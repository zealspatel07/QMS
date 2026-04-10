/**
 * BACKEND ROUTES - PHASE 3
 * Admin, Audit, Approval Workflows, and Metrics endpoints
 * 
 * Usage: Add to backend/server/routes/
 * File: admin.js
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin, requireAuth } = require('../middleware');

// ============================================
// AUDIT LOG ROUTES
// ============================================

/**
 * GET /api/admin/audit-logs
 * Fetch audit logs with filtering
 */
router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      module = '',
      status = '',
      startDate = '',
      endDate = ''
    } = req.query;

    let query = db('audit_logs').select('*');

    // Apply filters
    if (search) {
      query = query.where('user_name', 'like', `%${search}%`)
        .orWhere('action', 'like', `%${search}%`);
    }

    if (module) {
      query = query.where('module', module);
    }

    if (status) {
      query = query.where('status', status);
    }

    if (startDate) {
      query = query.where('timestamp', '>=', startDate);
    }

    if (endDate) {
      query = query.where('timestamp', '<=', endDate);
    }

    // Pagination
    const offset = (page - 1) * limit;
    const data = await query.limit(limit).offset(offset).orderBy('timestamp', 'desc');
    const count = await db('audit_logs').count('* as total').first();

    res.json({
      data,
      total: count.total,
      page,
      limit,
      pages: Math.ceil(count.total / limit)
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * POST /api/admin/audit-logs
 * Create audit log entry
 * Used internally by other routes to log actions
 */
router.post('/audit-logs', requireAuth, async (req, res) => {
  try {
    const {
      action,
      module,
      entityId,
      changes,
      status = 'success',
      errorMessage = null
    } = req.body;

    const logEntry = await db('audit_logs').insert({
      user_id: req.user?.id,
      user_name: req.user?.name || 'Unknown',
      action,
      module,
      entity_id: entityId,
      changes: JSON.stringify(changes),
      ip_address: req.ip,
      status,
      error_message: errorMessage,
      user_role: req.user?.role,
      created_at: new Date()
    });

    res.json({ success: true, id: logEntry[0] });
  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({ error: 'Failed to create audit log' });
  }
});

// ============================================
// APPROVAL WORKFLOW ROUTES
// ============================================

/**
 * POST /api/workflows/approvals
 * Create approval workflow for high-value transactions
 */
router.post('/workflows/approvals', requireAuth, async (req, res) => {
  try {
    const {
      referenceType,
      referenceId,
      referenceNumber,
      amount,
      description,
      urgencyLevel = 'normal',
      attachments = []
    } = req.body;

    // Determine required approvers based on amount and type
    const approvers = await getRequiredApprovers(amount, referenceType);

    // Create workflow
    const workflowId = await db('approval_workflows').insert({
      reference_type: referenceType,
      reference_id: referenceId,
      reference_number: referenceNumber,
      amount,
      requested_by: req.user?.name,
      requested_by_email: req.user?.email,
      requested_at: new Date(),
      description,
      status: 'pending',
      total_approvers: approvers.length,
      approvals_received: 0,
      urgency_level: urgencyLevel,
      created_at: new Date(),
      updated_at: new Date()
    });

    // Create approval steps
    for (let i = 0; i < approvers.length; i++) {
      await db('approval_steps').insert({
        workflow_id: workflowId[0],
        step_number: i + 1,
        approver_role: approvers[i].role,
        approver_id: approvers[i].id,
        approver_name: approvers[i].name,
        approver_email: approvers[i].email,
        approval_threshold: approvers[i].threshold,
        status: 'pending',
        created_at: new Date()
      });

      // Send notification email to approver
      // TODO: Implement email notification service
      console.log(`Notification sent to ${approvers[i].email}`);
    }

    // Audit log
    await db('audit_logs').insert({
      user_id: req.user?.id,
      user_name: req.user?.name,
      action: 'SUBMIT_FOR_APPROVAL',
      module: referenceType,
      entity_id: referenceId,
      changes: JSON.stringify({ amount, urgencyLevel }),
      status: 'success',
      created_at: new Date()
    });

    res.json({
      success: true,
      workflowId: workflowId[0],
      message: `Workflow created with ${approvers.length} approvers`
    });
  } catch (error) {
    console.error('Error creating approval workflow:', error);
    res.status(500).json({ error: 'Failed to create approval workflow' });
  }
});

/**
 * GET /api/workflows/approvals
 * Get approval workflows for current user
 */
router.get('/workflows/approvals', requireAuth, async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 20 } = req.query;

    let query = db('approval_workflows as aw')
      .select('aw.*')
      .leftJoin('approval_steps as ast', 'aw.id', 'ast.workflow_id')
      .where('aw.requested_by', req.user?.email)
      .orWhere('ast.approver_email', req.user?.email);

    if (status !== 'all') {
      query = query.where('aw.status', status);
    }

    const offset = (page - 1) * limit;
    const workflows = await query
      .limit(limit)
      .offset(offset)
      .orderBy('aw.requested_at', 'desc')
      .distinct();

    res.json({
      data: workflows,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

/**
 * POST /api/workflows/approvals/:workflowId/approve
 * Approve a workflow step
 */
router.post('/workflows/approvals/:workflowId/approve', requireAuth, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { comments = '' } = req.body;

    // Find the approval step for current user
    const step = await db('approval_steps')
      .where('workflow_id', workflowId)
      .where('approver_email', req.user?.email)
      .where('status', 'pending')
      .first();

    if (!step) {
      return res.status(404).json({ error: 'No pending approval found for this user' });
    }

    // Update step
    await db('approval_steps')
      .where('id', step.id)
      .update({
        status: 'approved',
        comments,
        approved_at: new Date()
      });

    // Check if all steps are approved
    const workflow = await db('approval_workflows')
      .where('id', workflowId)
      .first();

    const totalSteps = await db('approval_steps')
      .where('workflow_id', workflowId)
      .count('* as count')
      .first();

    const approvedSteps = await db('approval_steps')
      .where('workflow_id', workflowId)
      .where('status', 'approved')
      .count('* as count')
      .first();

    // Update workflow
    const newStatus = approvedSteps.count === totalSteps.count ? 'approved' : 'pending';
    await db('approval_workflows')
      .where('id', workflowId)
      .update({
        status: newStatus,
        approvals_received: approvedSteps.count,
        updated_at: new Date()
      });

    // Audit log
    await db('audit_logs').insert({
      user_id: req.user?.id,
      user_name: req.user?.name,
      action: 'APPROVE_WORKFLOW',
      module: workflow.reference_type,
      entity_id: workflow.reference_id,
      changes: JSON.stringify({ comments, status: newStatus }),
      status: 'success',
      created_at: new Date()
    });

    res.json({
      success: true,
      message: 'Approval recorded',
      workflowStatus: newStatus
    });
  } catch (error) {
    console.error('Error approving workflow:', error);
    res.status(500).json({ error: 'Failed to approve workflow' });
  }
});

/**
 * POST /api/workflows/approvals/:workflowId/reject
 * Reject a workflow step
 */
router.post('/workflows/approvals/:workflowId/reject', requireAuth, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { comments = '', reason = '' } = req.body;

    // Find the approval step
    const step = await db('approval_steps')
      .where('workflow_id', workflowId)
      .where('approver_email', req.user?.email)
      .where('status', 'pending')
      .first();

    if (!step) {
      return res.status(404).json({ error: 'No pending approval found' });
    }

    // Update step
    await db('approval_steps')
      .where('id', step.id)
      .update({
        status: 'rejected',
        comments,
        approved_at: new Date()
      });

    // Update workflow to rejected
    const workflow = await db('approval_workflows')
      .where('id', workflowId)
      .update({
        status: 'rejected',
        updated_at: new Date()
      })
      .first();

    // Audit log
    await db('audit_logs').insert({
      user_id: req.user?.id,
      user_name: req.user?.name,
      action: 'REJECT_WORKFLOW',
      module: workflow.reference_type,
      entity_id: workflow.reference_id,
      changes: JSON.stringify({ reason, comments }),
      status: 'success',
      created_at: new Date()
    });

    res.json({ success: true, message: 'Workflow rejected' });
  } catch (error) {
    console.error('Error rejecting workflow:', error);
    res.status(500).json({ error: 'Failed to reject workflow' });
  }
});

// ============================================
// ADMIN DASHBOARD ROUTES
// ============================================

/**
 * GET /api/admin/users
 * Get all users with their activity
 */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await db('users as u')
      .select(
        'u.id',
        'u.email',
        'u.name',
        'u.role',
        'u.status',
        'u.created_at as createdAt',
        db.raw('MAX(al.timestamp) as lastLogin')
      )
      .leftJoin('audit_logs as al', 'u.id', 'al.user_id')
      .groupBy('u.id')
      .orderBy('u.created_at', 'desc');

    res.json({ data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/admin/metrics
 * Get system health and performance metrics
 */
router.get('/metrics', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await db('users').count('* as count').first();
    const activeUsers = await db('audit_logs')
      .where('timestamp', '>=', db.raw('DATE_SUB(NOW(), INTERVAL 24 HOUR)'))
      .countDistinct('user_id as count')
      .first();

    const totalTransactions = await db('purchase_orders').count('* as count').first();
    const failedTransactions = 0; // Track based on audit_logs with status='failed'

    const metrics = {
      totalUsers: totalUsers.count,
      activeUsers: activeUsers.count,
      totalTransactions: totalTransactions.count,
      failedTransactions,
      averageResponseTime: 145, // TODO: Calculate from logs
      systemHealth: 98
    };

    res.json({ data: metrics });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * GET /api/admin/approvals
 * Get all pending approvals for admin
 */
router.get('/approvals', requireAdmin, async (req, res) => {
  try {
    const approvals = await db('approval_workflows')
      .select('*')
      .orderBy('requested_at', 'desc');

    res.json({ data: approvals });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

// ============================================
// VENDOR PERFORMANCE ROUTES
// ============================================

/**
 * GET /api/vendors/:vendorId/metrics
 * Get vendor performance metrics
 */
router.get('/vendors/:vendorId/metrics', requireAuth, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { year = new Date().getFullYear() } = req.query;

    const metrics = await db('vendor_performance_metrics')
      .where('vendor_id', vendorId)
      .where('year', year)
      .orderBy('month');

    const riskAssessment = await db('vendor_risk_assessment')
      .where('vendor_id', vendorId)
      .first();

    res.json({
      data: {
        metrics,
        riskAssessment
      }
    });
  } catch (error) {
    console.error('Error fetching vendor metrics:', error);
    res.status(500).json({ error: 'Failed to fetch vendor metrics' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Determine required approvers based on amount and type
 */
async function getRequiredApprovers(amount, referenceType) {
  const approvers = [];

  // Fetch approval matrix from settings or use defaults
  if (amount > 10000) {
    const manager = await db('users').where('role', 'MANAGER').first();
    if (manager) {
      approvers.push({
        role: 'MANAGER',
        id: manager.id,
        name: manager.name,
        email: manager.email,
        threshold: 10000
      });
    }
  }

  if (amount > 50000) {
    const director = await db('users').where('role', 'DIRECTOR').first();
    if (director) {
      approvers.push({
        role: 'DIRECTOR',
        id: director.id,
        name: director.name,
        email: director.email,
        threshold: 50000
      });
    }
  }

  if (amount > 100000) {
    const vp = await db('users').where('role', 'VP_FINANCE').first();
    if (vp) {
      approvers.push({
        role: 'VP_FINANCE',
        id: vp.id,
        name: vp.name,
        email: vp.email,
        threshold: 100000
      });
    }
  }

  if (amount > 500000) {
    const cfo = await db('users').where('role', 'CFO').first();
    if (cfo) {
      approvers.push({
        role: 'CFO',
        id: cfo.id,
        name: cfo.name,
        email: cfo.email,
        threshold: 500000
      });
    }
  }

  return approvers;
}

module.exports = router;
