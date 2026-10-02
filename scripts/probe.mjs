import fs from 'node:fs'
const t = fs.readFileSync('.token', 'utf8').trim()
console.log('token: len', t.length, '| prefix', t.slice(0, 4))
const r = await fetch('https://api.github.com/user', { headers: { authorization: `Bearer ${t}`, 'user-agent': 'yuliang-probe' } })
const b = await r.json()
console.log('user:', r.status, '| login:', b.login, '| scopes:', r.headers.get('x-oauth-scopes'))
