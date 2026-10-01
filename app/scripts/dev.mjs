// 同時啟動後端 API（8787）與前端開發伺服器（5173）
import { spawn } from 'node:child_process';

const procs = [
  spawn('npm', ['run', 'dev:server'], { stdio: 'inherit', shell: true }),
  spawn('npm', ['run', 'dev:client'], { stdio: 'inherit', shell: true }),
];
const stop = () => { procs.forEach((p) => p.kill()); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
