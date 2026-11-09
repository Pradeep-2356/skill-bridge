/** Small, explicit factories for test data. Each call creates exactly what it says. */
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { expect } from 'vitest';
import { User, Category, Skill, Session } from '../../src/models/index.js';

let counter = 0;
const next = () => {
  counter += 1;
  return counter;
};

export const DEFAULT_PASSWORD = 'Str0ng!Pass';

export async function createUser(overrides = {}) {
  const n = next();
  const { password = DEFAULT_PASSWORD, ...rest } = overrides;
  const user = await User.create({
    name: `Test User ${n}`,
    email: `user${n}@skillbridge.test`,
    passwordHash: await bcrypt.hash(password, 4),
    timezone: 'Asia/Kolkata',
    ...rest,
  });
  return { user, password };
}

export async function createCategory(overrides = {}) {
  const n = next();
  return Category.create({ name: `Category ${n}`, slug: `category-${n}`, icon: 'tag', order: n, ...overrides });
}

export async function createSkill(overrides = {}) {
  const n = next();
  const category = overrides.category ?? (await createCategory())._id;
  return Skill.create({ name: `Skill ${n}`, category, ...overrides });
}

export async function createSession(overrides = {}) {
  return Session.create({ startsAt: new Date(Date.now() + 86_400_000), ...overrides });
}

/** Logs in through the real API and returns a Supertest agent that keeps the cookies. */
export async function loginAgent(app, email, password = DEFAULT_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send({ email, password });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return agent;
}

/** Creates a user and returns an agent already logged in as them. */
export async function signedInUser(app, overrides = {}) {
  const { user, password } = await createUser(overrides);
  const agent = await loginAgent(app, user.email, password);
  return { user, password, agent };
}

/** Reads a cookie's attributes from a Set-Cookie header array. */
export function findCookie(res, name) {
  const header = [res.headers['set-cookie'] ?? []].flat().find((c) => c.startsWith(`${name}=`));
  if (!header) return null;
  const [pair, ...attrs] = header.split(';').map((s) => s.trim());
  return {
    value: pair.slice(name.length + 1),
    attrs: attrs.map((a) => a.toLowerCase()),
    raw: header,
  };
}
