// 帳號與登入：密碼以 scrypt 雜湊保存，登入後發給隨機 token
import crypto from 'node:crypto';

const hash = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');

export function makeAuth(db) {
  const q = {
    count: db.prepare('SELECT COUNT(*) AS n FROM users'),
    byName: db.prepare('SELECT * FROM users WHERE username = ?'),
    insert: db.prepare('INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)'),
    session: db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)'),
    lookup: db.prepare('SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'),
    logout: db.prepare('DELETE FROM sessions WHERE token = ?'),
  };

  const newSession = (userId) => {
    const token = crypto.randomBytes(32).toString('hex');
    q.session.run(token, userId, new Date().toISOString());
    return token;
  };

  return {
    userCount: () => q.count.get().n,
    register(username, password) {
      const salt = crypto.randomBytes(16).toString('hex');
      const info = q.insert.run(username, hash(password, salt), salt, new Date().toISOString());
      const id = Number(info.lastInsertRowid);
      return { token: newSession(id), user: { id, username } };
    },
    login(username, password) {
      const u = q.byName.get(username);
      if (!u) return null;
      const expected = Buffer.from(u.password_hash, 'hex');
      const actual = Buffer.from(hash(password, u.salt), 'hex');
      if (!crypto.timingSafeEqual(expected, actual)) return null;
      return { token: newSession(u.id), user: { id: u.id, username: u.username } };
    },
    exists: (username) => !!q.byName.get(username),
    lookup: (token) => (token ? q.lookup.get(token) || null : null),
    logout: (token) => q.logout.run(token),
  };
}
