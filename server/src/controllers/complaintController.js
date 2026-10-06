import { asyncHandler, sendOk, sendCreated } from '../utils/http.js';
import * as complaintService from '../services/complaintService.js';
import { recordAudit } from '../middleware/audit.js';

export const list = asyncHandler(async (req, res) => {
  const result = await complaintService.listComplaints(req.user, { ...(req.validatedQuery ?? req.query), mineUserId: req.user?.id });
  return sendOk(res, result.items, undefined, { pagination: result.pagination });
});

export const get = asyncHandler(async (req, res) => {
  return sendOk(res, await complaintService.getComplaint(req.user, req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  const complaint = await complaintService.createComplaint(req.user, req.body, req.uploadedImage);
  await recordAudit({
    userId: req.user.id,
    action: 'complaint.create',
    entity: 'complaints',
    entityId: complaint.id,
    meta: { complaintId: complaint.complaintId },
    ip: req.ip,
  });
  return sendCreated(res, complaint, `Complaint registered successfully. Your reference number is ${complaint.complaintId}.`);
});

export const update = asyncHandler(async (req, res) => {
  const complaint = await complaintService.updateComplaint(req.user, req.params.id, req.body);
  await recordAudit({ userId: req.user.id, action: 'complaint.update', entity: 'complaints', entityId: complaint.id, ip: req.ip });
  return sendOk(res, complaint, 'Complaint details updated successfully.');
});

export const approve = asyncHandler(async (req, res) => {
  const complaint = await complaintService.approveComplaint(req.user, req.params.id, req.body?.remarks);
  await recordAudit({ userId: req.user.id, action: 'complaint.approve', entity: 'complaints', entityId: complaint.id, ip: req.ip });
  return sendOk(res, complaint, `Complaint ${complaint.complaintId} has been approved and moved to In Progress.`);
});

export const assign = asyncHandler(async (req, res) => {
  const complaint = await complaintService.assignOfficer(req.user, req.params.id, req.body.officerId, req.body.notes);
  await recordAudit({
    userId: req.user.id,
    action: 'complaint.assign',
    entity: 'complaints',
    entityId: complaint.id,
    meta: { officerId: req.body.officerId },
    ip: req.ip,
  });
  return sendOk(res, complaint, `Complaint assigned to ${complaint.assignment?.officerName ?? 'the selected officer'}.`);
});

export const changeStatus = asyncHandler(async (req, res) => {
  const complaint = await complaintService.changeStatus(req.user, req.params.id, req.body);
  await recordAudit({
    userId: req.user.id,
    action: `complaint.status.${req.body.status}`,
    entity: 'complaints',
    entityId: complaint.id,
    ip: req.ip,
  });
  return sendOk(res, complaint, `Complaint status updated to ${complaint.statusLabel}.`);
});

export const addRemark = asyncHandler(async (req, res) => {
  const complaint = await complaintService.addRemark(req.user, req.params.id, req.body.remarks, req.body.status);
  return sendOk(res, complaint, 'Remark added to the complaint.');
});

export const remove = asyncHandler(async (req, res) => {
  const result = await complaintService.deleteComplaint(req.user, req.params.id);
  await recordAudit({ userId: req.user.id, action: 'complaint.delete', entity: 'complaints', entityId: result.id, ip: req.ip });
  return sendOk(res, result, `Complaint ${result.complaintId} has been deleted.`);
});

export const history = asyncHandler(async (req, res) => {
  return sendOk(res, await complaintService.getHistory(req.user, req.params.id));
});

export const track = asyncHandler(async (req, res) => {
  const { complaintId, rationNumber } = req.validatedQuery ?? req.query;
  const results = await complaintService.trackComplaint(req.user, { complaintId, rationNumber });
  return sendOk(res, results, results.length === 1 ? undefined : `${results.length} complaints found.`);
});

export const stats = asyncHandler(async (req, res) => {
  const filters = req.validatedQuery ?? req.query;
  return sendOk(res, await complaintService.countsByStatus(req.user, filters));
});

export default { list, get, create, update, approve, assign, changeStatus, addRemark, remove, history, track, stats };
