# icp — ICP replica subnet (Helm)

`victor138128/ic` 포크(`feature/v4-block-api`, replica 0.9.0)를 홈 k3s 클러스터의
`infra` 네임스페이스에 올립니다. **앱 연동과 IITP tc2 측정을 같은 노드로 처리**하는 것이
목적입니다.

포크를 쓰는 이유는 tc2 측정 도구(`ratel-vote-tps`)가 `/api/v4/height`,
`/api/v4/blocks`로 finalized 블록을 읽어 집계하기 때문입니다. 이 엔드포인트는 포크에만
있어서, dfx/PocketIC로는 측정 자체가 되지 않습니다.

## 사용

```bash
# 앱 연동용 (단일 노드)
helm upgrade --install icp infra/helm/icp -n infra --create-namespace \
  -f infra/helm/icp/environments/dev.yaml

# tc2 측정용 (4노드 서브넷)
helm upgrade --install icp infra/helm/icp -n infra \
  -f infra/helm/icp/environments/tc2.yaml
```

앱 연결은 코드 수정 없이 env 하나면 됩니다. `config/server/icp.rs`가 런타임 `IC_URL`을
컴파일 타임 값보다 우선합니다.

```yaml
- name: IC_URL
  value: http://icp.infra.svc.cluster.local:4100
```

## 노드 수

| replicaCount | 용도 | 비고 |
|---|---|---|
| 1 | 앱 연동, 기능 확인 | 합의 없음 |
| 4 | **tc2 측정** | n=3f+1, f=1. 지표가 "finalized 블록 포함 수"라 합의 필수 |

## 서브넷 부트스트랩

genconfig는 **실행할 때마다 새 노드 키와 새 서브넷 ID를 만듭니다.** 그래서 서브넷 전체에
대해 **딱 한 번만** 돌아야 합니다. 파드마다 돌리면 4개가 서로 다른 서브넷이 되어 합의가
영원히 형성되지 않습니다. (EC2에서 genconfig를 두 번 돌렸을 때 노드 ID가 전부 바뀌는 걸
확인했습니다)

피어 주소가 values의 고정 ClusterIP라서 **파드가 뜨기 전에 생성이 가능**합니다.

```
helm install
  └─ pre-install Job (genconfig)
       ├─ initContainer: NODES="10.43.100.11 ... .14" 로 생성 → tar.gz
       └─ container:     kubectl 로 Secret `icp-subnet` 생성
  └─ StatefulSet
       └─ 각 파드가 같은 Secret 을 마운트 → 풀기 → state-10X 복제 → replica 실행
```

`helm upgrade`는 **재생성하지 않습니다.** 새 레지스트리는 곧 height 0부터의 새 체인이고
캐니스터 재배포를 뜻하기 때문입니다. 일부러 다시 만들려면:

```bash
kubectl -n infra delete secret icp-subnet
kubectl -n infra delete pvc -l app.kubernetes.io/name=icp
```

## 주소 설계

replica는 **설정 파일**에서 bind 주소를 읽습니다 (`http_handler.listen_addr`,
`message_routing.xnet_ip_addr`). 그래서 전부 `0.0.0.0`으로 bind하고, **레지스트리에는
파드별 고정 ClusterIP를 광고**합니다.

파드 IP는 재시작마다 바뀌지만 ClusterIP는 고정이므로, 피어가 서로를 계속 찾을 수 있습니다.
EC2 테스트베드에서 private IP를 고정했던 것과 같은 접근입니다.

```yaml
addressing:
  mode: clusterIp
  clusterIPs: [10.43.100.11, 10.43.100.12, 10.43.100.13, 10.43.100.14]
```

### ⚠️ 첫 배포 때 반드시 확인할 것

XNet과 HTTP API는 설정 파일 기반이 확인됐지만, **P2P(QUIC)는 레지스트리 주소로 bind하는
것으로 보입니다.** 파드가 이렇게 죽으면 그 경우입니다.

```
failed to bind ... Cannot assign requested address
```

ClusterIP는 파드 안에서 bind할 수 없기 때문입니다. 그때는 `addressing.mode: podIp`로 바꾸세요. 파드가 자기 IP로 설정을 직접 만듭니다.
**단 이 모드는 `replicaCount: 1` 에서만 씁니다** — 여러 노드가 하나의 레지스트리를
공유해야 하는데 파드 IP는 미리 알 수 없기 때문입니다. 차트가 `replicaCount > 1` 이면
렌더링을 거부합니다.

즉 P2P bind가 ClusterIP에서 막히면 **4노드 구성 자체를 다시 설계해야 합니다**
(hostNetwork + 노드 고정 등). 첫 배포에서 가장 먼저 확인할 항목인 이유입니다.

## 보안

로컬 ICP replica에는 **인증이 없습니다.** provisional 관리 API가 열려 있어 접근 가능한
사람은 누구나 캐니스터를 만들고 임의 wasm을 설치·실행할 수 있습니다.

- `ingress.enabled: false` (기본값) — 내부 전용
- 켜려면 `ingress.whitelistSourceRange`가 **필수**입니다. 없이 켜면 차트가 렌더링을
  거부합니다. basic auth는 dfx가 인증 헤더를 못 보내서 배포가 깨지므로 IP 허용목록을 씁니다
- `networkPolicy` — 파드가 `infra`의 postgres/minio/registry로 나가지 못하게 막습니다
- `automountServiceAccountToken: false` — 파드에서 k8s API 접근 차단

노트북에서 배포할 때는 노출 대신 port-forward를 쓰세요.

```bash
kubectl -n infra port-forward svc/icp 4100:4100
```

참고로 캐니스터 쪽은 `upsert_vote`에 `require_controller()`가 있어 **투표 위조는
불가능**합니다. 다만 `run_sampling`에는 그 가드가 없고 query는 전부 열려 있습니다.

## 이미지

`deploy/dev/Dockerfile.icp`가 replica와 ic-testnet 설정 생성기를 함께 빌드합니다.

**클러스터가 arm64이고, 이 포크는 Rust 1.80 고정의 2024년대 코드입니다.** aarch64-linux
빌드가 되는지는 아직 검증되지 않았습니다. DFINITY가 dfx에 aarch64 replica를 넣고 있으니
가능성은 있지만, **이미지 빌드부터 성공시켜야 나머지가 의미가 있습니다.**

```bash
docker build -f deploy/dev/Dockerfile.icp -t ratel-icp:dev .
```

## 남은 검증 항목

1. arm64 빌드 성공 여부 — 가장 먼저
2. 단일 파드에서 `/api/v4/height` 응답
3. 4노드 합의 형성 (위 P2P bind 문제)
4. TPS 측정 → 리소스 사양 산정 (현재 값은 EC2 실측의 load average ~0.9 근거로 잡은 추정치)
