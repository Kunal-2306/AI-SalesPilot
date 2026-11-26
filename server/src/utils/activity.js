import ActivityLog from '../models/ActivityLog.js';

export const logActivity = async (userId, type, title, description = '', metadata = {}) => {
  try {
    await ActivityLog.create({ userId, type, title, description, metadata });
  } catch (err) {
    console.warn('[ActivityLog] Failed to record activity:', err.message);
  }
};
