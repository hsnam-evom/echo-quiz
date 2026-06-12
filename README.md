# 에코 퀴-즈 (Echo Quiz)

심초음파(Echocardiography) 임상 지식을 겨루는 **레트로 퀴즈 웹앱**. 100문항 중 랜덤 10문제에 도전하고, 점수에 따라 진단(?)을 받고, 글로벌 리더보드에 이름을 올립니다.

🔗 라이브: https://echo-quiz.vercel.app

## 기능

- 닉네임 입력 후 시작 (재도전 시 다시 입력)
- 100문항 중 **랜덤 10문제** 출제
- 4지선다, **정답 위치는 매 문제 무작위 셔플**
- 틀리면 **한 번 더 기회** (고른 오답은 비활성화)
- 채점: 1차 정답 **10점** / 재도전 정답 **5점** / 실패 0점 (만점 100)
- 매 문제 **정답 + 가이드라인 근거 해설** 공개
- 10문제 결과 요약 + **점수별 재미 문구**
- **글로벌 리더보드 상위 10명**
- CRT 스캔라인 · 픽셀 폰트 · 8비트 효과음 레트로 스타일

## 구조

```
index.html              # SPA 진입점
styles/retro.css        # 레트로/CRT 테마
src/quiz.js             # 출제·셔플·채점·티어 (순수 로직)
src/leaderboard.js      # 리더보드 API 클라이언트
src/main.js             # 상태 머신·렌더·효과음
questions.json          # 문제 데이터 (엑셀에서 생성)
api/leaderboard.js      # GET  상위 10명
api/score.js            # POST 점수 등록
lib/redis.js            # Upstash Redis REST 헬퍼
scripts/build-questions.py  # 엑셀 → questions.json 변환
```

## 데이터 갱신

`echo_quiz_100_v2.xlsx`를 수정한 뒤:

```bash
pip install openpyxl
python3 scripts/build-questions.py ../echo_quiz_100_v2.xlsx questions.json
```

## 리더보드 (Upstash Redis)

글로벌 리더보드는 Vercel 서버리스 함수 + Upstash Redis(Vercel Marketplace)를 사용합니다.
환경변수 `KV_REST_API_URL`/`KV_REST_API_TOKEN`(또는 `UPSTASH_REDIS_REST_URL`/`..._TOKEN`)이
설정되면 자동 활성화되고, 없으면 게임은 그대로 동작하되 리더보드만 비활성화됩니다.

```bash
vercel integration add upstash/upstash-kv   # 프로비저닝(대화형)
vercel deploy --prod                          # 환경변수 반영 재배포
```

## 배포

`main` 브랜치 푸시 시 Vercel 자동 배포(연동 시). 수동 배포는 `vercel deploy --prod`.

> 교육용 콘텐츠입니다. 실제 임상 판단은 최신 가이드라인과 전문가 소견을 따르세요.
