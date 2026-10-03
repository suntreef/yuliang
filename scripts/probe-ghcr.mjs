// 探测 GHCR 镜像匿名可见性:匿名 token → 拉 manifest
const img = 'suntreef/yuliang'
const t = await fetch(`https://ghcr.io/token?scope=repository:${img}:pull`).then((r) => r.json())
console.log('匿名 token:', t.token ? '获得' : '未获得')
const r = await fetch(`https://ghcr.io/v2/${img}/manifests/latest`, {
  headers: {
    authorization: `Bearer ${t.token}`,
    accept: 'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json',
  },
})
console.log('manifest latest:', r.status)
if (r.ok) {
  const m = await r.json()
  console.log('架构:', (m.manifests || []).map((x) => x.platform?.architecture).join(', '))
}
