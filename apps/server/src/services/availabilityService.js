/** Weekly availability and time zone (SB1/US27–29). */
import { sortSlots } from '@skillbridge/shared';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

const shape = (user) => ({
  timezone: user.timezone,
  slots: sortSlots(user.availability.map(({ day, start, end }) => ({ day, start, end }))),
});

export async function getAvailability(userId) {
  const user = await User.findById(userId).select('timezone availability');
  if (!user) throw AppError.notFound('Account not found.');
  return shape(user);
}

/** Replaces the whole weekly schedule. Overlaps were already rejected by the schema. */
export async function replaceAvailability(userId, { timezone, slots }) {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('Account not found.');
  user.timezone = timezone;
  user.availability = sortSlots(slots);
  await user.save();
  return shape(user);
}
